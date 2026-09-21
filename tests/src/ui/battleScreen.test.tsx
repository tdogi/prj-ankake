import "@testing-library/jest-dom/vitest";
import {
  coordinateKey,
  placeCreatureForTest,
  projectPublicBattleView,
  updateBattleBase,
  type BattleCardInstance,
  type BattleLogEntry,
  type BattleState
} from "@ankake/domain";
import {
  BattleScreen,
  getNextBoardFocusKey,
  type BoardFocusDirection
} from "@ankake/ui";
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
  within
} from "@testing-library/react";
import fc from "fast-check";
import { useState } from "react";
import type { DeckRepository } from "@ankake/persistence";
import {
  IDLE_BATTLE_INTERACTION,
  cancelBattleInteraction,
  projectBattleInteractionFromState,
  selectMovementCreature,
  selectMovementStep,
  selectSummonDestination,
  selectSummonHandCard,
  undoMovementStep,
  type BattleInteractionState
} from "../../../apps/web/src/battle/battleInteraction";
import { activeAttackerForEvent, defeatedCreatureFor, useBattleController } from "../../../apps/web/src/battle/useBattleController";
import {
  battleStateArbitrary,
  canonicalBoardCoordinateArbitrary
} from "../generators/battleGenerators";
import { validCatalogSnapshotFixture } from "../generators/catalogGenerators";

const battleSetupMocks = vi.hoisted(() => ({
  loadBattlePreparation: vi.fn(),
  startBattle: vi.fn()
}));

vi.mock("../../../apps/web/src/battle/battleSetupService", () => ({
  loadBattlePreparation: battleSetupMocks.loadBattlePreparation,
  startBattle: battleSetupMocks.startBattle,
  getBattleStartDisabledReason: (state: {
    readonly loading: boolean;
    readonly playerDeckId?: string;
    readonly cpuDeckId?: string;
  }) =>
    state.loading || !state.playerDeckId || !state.cpuDeckId
      ? "Battle setup is not ready."
      : undefined
}));

const LOG_ENTRIES: readonly BattleLogEntry[] = [
  {
    sequence: 1,
    message: "Player drew a card.",
    type: "card.drawn",
    side: "player"
  }
];

describe("battle screen", () => {
  it("labels the resignation control and invokes its handler", () => {
    const onQuitBattle = vi.fn();
    renderBattleScreen(projectPublicBattleView(createBattleScreenState()), { onQuitBattle });

    const button = screen.getByTestId("battle-quit-button");
    expect(button).toHaveTextContent("リタイア");
    fireEvent.click(button);
    expect(onQuitBattle).toHaveBeenCalledTimes(1);
  });

  it("shows the human opponent name instead of CPU labels when supplied", () => {
    renderBattleScreen(projectPublicBattleView(createBattleScreenState()), { opponentName: "Player Two" });
    expect(screen.getByTestId("battle-cpu-info-panel")).toHaveTextContent("Player Two");
    fireEvent.click(screen.getByTestId("battle-resonance-cpu-tab"));
    expect(screen.getByTestId("battle-resonance-cpu-tab")).toHaveTextContent("Player Two");
  });

  it("shows a specific Japanese reason for an unplayable hand card", () => {
    const viewModel = projectPublicBattleView(createBattleScreenState());
    const unavailableCard = {
      ...viewModel.playerHand[0]!,
      isActionable: false,
      disabledReason: "battle.resource.pp-insufficient"
    };
    const unavailableView = { ...viewModel, playerHand: [unavailableCard] };

    render(
      <BattleScreen viewModel={unavailableView} locale="ja" logEntries={LOG_ENTRIES} cpuStatus="idle"
        onReturnToPreparation={vi.fn()} onReturnToMenu={vi.fn()} onEndPlayPhase={vi.fn()} onRematch={vi.fn()} onQuitBattle={vi.fn()} />
    );

    const card = screen.getByTestId(`battle-hand-card-${unavailableCard.instanceId}`);
    expect(card).toHaveTextContent("PPが不足しています。");
    expect(card).not.toHaveTextContent("問題が発生しました");
  });

  it("renders the sparse board, five bases, public resources, and no visible coordinates", () => {
    const initialState = createBattleScreenState();
    const state: BattleState = {
      ...initialState,
      bases: updateBattleBase(
        updateBattleBase(initialState.bases, "player-base", (base) => ({
          ...base,
          currentHp: 13
        })),
        "cpu-base",
        (base) => ({ ...base, currentHp: 7 })
      )
    };
    const viewModel = projectPublicBattleView(state);
    const { container } = renderBattleScreen(viewModel);

    expect(screen.getByTestId("shared-background-scene")).toBeInTheDocument();
    expect(screen.getAllByRole("gridcell")).toHaveLength(75);
    expect(screen.queryByTestId("battle-square-1-1")).not.toBeInTheDocument();
    expect(screen.getByTestId("battle-square-3-1")).toHaveStyle({
      gridColumn: "3",
      gridRow: "1"
    });
    expect(screen.getByTestId("battle-square-6-1")).toHaveTextContent("HP 7/20");
    expect(screen.getByTestId("battle-square-6-9")).toHaveTextContent("HP 13/20");
    expect(screen.getByTestId("battle-square-2-5")).toHaveTextContent("HP 10/10");
    expect(screen.getByTestId("battle-square-6-5")).toHaveTextContent("HP 20/20");
    expect(screen.getByTestId("battle-square-10-5")).toHaveTextContent("HP 10/10");
    expect(screen.getByTestId("battle-player-pp")).toHaveTextContent("10/10 PP");
    const sideRail = container.querySelector(".battle-side-rail");
    expect(sideRail).not.toBeNull();
    expect(Array.from(sideRail!.children).map((element) => element.getAttribute("data-testid"))).toEqual([
      "battle-resource-controls",
      "battle-interaction-controls",
      "battle-card-counts-panel",
      "battle-resonance-panel",
      "battle-log-control"
    ]);
    expect(screen.queryByTestId("battle-base-summary")).not.toBeInTheDocument();
    expect(screen.getByTestId("battle-card-counts-panel")).toHaveTextContent("Hand: 9");
    expect(screen.getByTestId("battle-card-counts-panel")).toHaveTextContent("Deck:");
    expect(screen.getByTestId("battle-cpu-info-panel")).toHaveTextContent("Hand: 5");
    expect(screen.getByTestId("battle-player-graveyard-button")).toHaveTextContent("Graveyard: 0");
    expect(screen.queryByTestId("battle-log-panel")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("battle-log-toggle"));
    expect(screen.getByTestId("battle-log-panel")).toHaveTextContent("Player drew a card.");

    for (const square of container.querySelectorAll<HTMLElement>(".battle-square")) {
      expect(square.textContent).not.toMatch(/^\s*\d+,\d+/);
    }
  });

  it("preserves lane identity while marking summon territory and captured-base territory", () => {
    const initialState = createBattleScreenState();
    const viewModel = projectPublicBattleView({
      ...initialState,
      bases: updateBattleBase(initialState.bases, "neutral-center", (base) => ({
        ...base,
        owner: "player"
      }))
    });
    renderBattleScreen(viewModel);

    const initialSummonSquare = screen.getByTestId("battle-square-3-9");
    expect(initialSummonSquare).toHaveClass("battle-square--initial-summon-area");
    expect(initialSummonSquare).toHaveAttribute("data-lane", "left");
    expect(screen.getByTestId("battle-square-5-4")).toHaveClass(
      "battle-square--controlled-base-summon-area"
    );
    expect(screen.getByTestId("battle-base-neutral-center")).toHaveAttribute("data-base-owner", "player");
  });

  it("switches between player and CPU resonance while preserving active values and effect help", () => {
    const initialState = createBattleScreenState();
    const viewModel = projectPublicBattleView({
      ...initialState,
      players: {
        ...initialState.players,
        player: {
          ...initialState.players.player,
          resonance: {
            ...initialState.players.player.resonance,
            center: { ...initialState.players.player.resonance.center, fire: 15, water: 14 }
          }
        },
        cpu: {
          ...initialState.players.cpu,
          resonance: {
            ...initialState.players.cpu.resonance,
            right: { ...initialState.players.cpu.resonance.right, dark: 15 }
          }
        }
      }
    });
    renderBattleScreen(viewModel);

    expect(screen.getByTestId("battle-resonance-center-fire")).toHaveClass(
      "battle-resonance-table__cell--active"
    );
    expect(screen.getByTestId("battle-resonance-center-water")).not.toHaveClass(
      "battle-resonance-table__cell--active"
    );
    const resonance = screen.getByTestId("battle-player-resonance");
    fireEvent.mouseEnter(resonance);
    expect(screen.getByTestId("battle-resonance-effects")).toHaveTextContent("Fire");
    expect(screen.getByTestId("battle-resonance-effects")).toHaveTextContent("Dark");
    expect(screen.getByTestId("battle-resonance-effects")).toHaveClass(
      "battle-resonance__effects--left"
    );
    fireEvent.mouseLeave(resonance);
    expect(screen.queryByTestId("battle-resonance-effects")).not.toBeInTheDocument();
    act(() => resonance.focus());
    expect(screen.getByTestId("battle-resonance-effects")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("battle-resonance-cpu-tab"));
    expect(screen.getByTestId("battle-cpu-resonance")).toBeInTheDocument();
    expect(screen.getByTestId("battle-resonance-right-dark")).toHaveClass("battle-resonance-table__cell--active");
  });

  it("skips absent coordinates during roving keyboard focus", () => {
    const viewModel = projectPublicBattleView(createBattleScreenState());
    renderBattleScreen(viewModel);

    const rowTwoColumnThree = screen.getByTestId("battle-square-3-2");
    act(() => rowTwoColumnThree.focus());
    fireEvent.keyDown(rowTwoColumnThree, { key: "ArrowRight" });

    expect(screen.getByTestId("battle-square-5-2")).toHaveFocus();
    fireEvent.keyDown(screen.getByTestId("battle-square-5-2"), {
      key: "ArrowLeft"
    });
    expect(rowTwoColumnThree).toHaveFocus();

    const rowOneColumnThree = screen.getByTestId("battle-square-3-1");
    act(() => rowOneColumnThree.focus());
    fireEvent.keyDown(rowOneColumnThree, { key: "ArrowLeft" });
    expect(rowOneColumnThree).toHaveFocus();
  });

  it("renders nine addressable hand cards, actionable spells, and artwork fallbacks", () => {
    const state = createBattleScreenState();
    const viewModel = projectPublicBattleView(state);
    const { container } = renderBattleScreen(viewModel);

    expect(
      container.querySelectorAll('[data-testid^="battle-hand-card-"]')
    ).toHaveLength(9);
    expect(screen.getByTestId("battle-player-hand-count")).toHaveTextContent("9 cards");

    const spell = viewModel.playerHand.find((card) => card.type === "spell");
    if (!spell) {
      throw new Error("Expected a spell fixture.");
    }
    const spellButton = screen.getByTestId(`battle-hand-card-${spell.instanceId}`);
    expect(spell.isActionable).toBe(true);
    expect(spellButton).toHaveAttribute("aria-disabled", "false");
    expect(spellButton).not.toHaveTextContent("Spell effects are planned for a later cycle.");

    const firstCard = viewModel.playerHand[0];
    const firstCardButton = screen.getByTestId(
      `battle-hand-card-${firstCard.instanceId}`
    );
    const image = within(firstCardButton).getByTestId(
      `battle-card-artwork-${firstCard.catalogCardId}`
    );
    fireEvent.error(image);
    expect(
      within(firstCardButton).getByTestId(
        `battle-card-artwork-fallback-${firstCard.catalogCardId}`
      )
    ).toHaveTextContent(firstCard.name);

    expect(
      container.querySelectorAll('[data-testid^="battle-board-card-"]')
    ).toHaveLength(1);

    const occupiedSquare = viewModel.boardSquares.find(
      (square) => square.occupant
    );
    if (!occupiedSquare?.occupant) {
      throw new Error("Expected an occupied board square fixture.");
    }
    const boardCard = screen.getByTestId(
      `battle-board-card-${occupiedSquare.occupant.instanceId}`
    );
    expect(boardCard).toHaveTextContent(
      `ATK ${occupiedSquare.occupant.currentAttack}`
    );
    expect(boardCard).toHaveTextContent(
      `HP ${occupiedSquare.occupant.currentHp}`
    );
    expect(boardCard).not.toHaveTextContent(occupiedSquare.occupant.name);
    expect(boardCard).not.toHaveTextContent(occupiedSquare.occupant.ownerLabel);
    expect(boardCard.querySelector(".battle-card__name")).toBeNull();
  });

  it("highlights board creatures using their controller's base ownership color", () => {
    const initialState = createBattleScreenState();
    const playerCreature = Object.values(initialState.cardInstances).find(
      (card) => card.zone === "board" && card.controllerSide === "player"
    );
    const cpuCreature = Object.values(initialState.cardInstances).find(
      (card) => card.ownerSide === "cpu"
    );
    if (!playerCreature || !cpuCreature) {
      throw new Error("Expected player and CPU creature fixtures.");
    }
    const state = placeCreatureForTest({
      ...initialState,
      cardInstances: {
        ...initialState.cardInstances,
        [cpuCreature.instanceId]: {
          ...cpuCreature,
          type: "creature",
          attack: cpuCreature.attack ?? 3,
          currentAttack: cpuCreature.currentAttack ?? cpuCreature.attack ?? 3,
          health: cpuCreature.health ?? 4,
          currentHp: cpuCreature.currentHp ?? cpuCreature.health ?? 4,
          maxHp: cpuCreature.maxHp ?? cpuCreature.health ?? 4
        }
      }
    }, cpuCreature.instanceId, "cpu", 8, 5);

    renderBattleScreen(projectPublicBattleView(state));

    expect(screen.getByTestId(`battle-board-card-${playerCreature.instanceId}`)).toHaveClass(
      "battle-card--owner-highlight",
      "battle-card--player"
    );
    expect(screen.getByTestId(`battle-board-card-${cpuCreature.instanceId}`)).toHaveClass(
      "battle-card--owner-highlight",
      "battle-card--cpu"
    );
  });

  it("opens one non-interactive card detail popover and closes it on Escape", () => {
    const viewModel = projectPublicBattleView(createBattleScreenState());
    renderBattleScreen(viewModel);
    const handCard = screen.getByTestId(`battle-hand-card-${viewModel.playerHand[0]!.instanceId}`);

    fireEvent.pointerEnter(handCard, { pointerType: "mouse" });
    expect(screen.getByTestId("battle-card-detail-popover")).toHaveTextContent(viewModel.playerHand[0]!.name);

    fireEvent.focus(handCard);
    expect(screen.getAllByTestId("battle-card-detail-popover")).toHaveLength(1);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByTestId("battle-card-detail-popover")).not.toBeInTheDocument();
  });

  it("localizes battle panels and card detail fields", () => {
    const viewModel = projectPublicBattleView(createBattleScreenState());
    render(<BattleScreen viewModel={viewModel} locale="ja" logEntries={LOG_ENTRIES} cpuStatus="thinking" onReturnToPreparation={vi.fn()} onReturnToMenu={vi.fn()} onEndPlayPhase={vi.fn()} onRematch={vi.fn()} onQuitBattle={vi.fn()} />);
    expect(screen.getByTestId("battle-status-bar")).toHaveTextContent("ターン");
    expect(screen.getByTestId("battle-player-info-panel")).toHaveTextContent("手札");
    expect(screen.getByTestId("battle-log-toggle")).toHaveTextContent("対戦ログ");
    const handCard = screen.getByTestId(`battle-hand-card-${viewModel.playerHand[0]!.instanceId}`);
    fireEvent.focus(handCard);
    expect(screen.getByTestId("battle-card-detail-popover")).toHaveTextContent("移動力");
    expect(screen.getByTestId("battle-card-detail-popover")).toHaveTextContent("効果:");
  });

  it("opens and closes the battle log popover without adding it to the side rail", () => {
    const viewModel = projectPublicBattleView(createBattleScreenState());
    renderBattleScreen(viewModel);

    const toggle = screen.getByTestId("battle-log-toggle");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByTestId("battle-log-panel")).toHaveTextContent("Player drew a card.");

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByTestId("battle-log-panel")).not.toBeInTheDocument();

    fireEvent.click(toggle);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByTestId("battle-log-panel")).not.toBeInTheDocument();

    fireEvent.click(toggle);
    fireEvent.pointerDown(document.body);
    expect(screen.queryByTestId("battle-log-panel")).not.toBeInTheDocument();
  });

  it("scrolls to the most recent log entry only when the log opens", () => {
    const viewModel = projectPublicBattleView(createBattleScreenState());
    const scrollHeightDescriptor = Object.getOwnPropertyDescriptor(HTMLOListElement.prototype, "scrollHeight");
    Object.defineProperty(HTMLOListElement.prototype, "scrollHeight", { configurable: true, get: () => 480 });
    try {
      const { rerender } = render(<BattleScreen viewModel={viewModel} logEntries={LOG_ENTRIES} cpuStatus="idle" onReturnToPreparation={vi.fn()} onReturnToMenu={vi.fn()} onEndPlayPhase={vi.fn()} onRematch={vi.fn()} onQuitBattle={vi.fn()} />);
      fireEvent.click(screen.getByTestId("battle-log-toggle"));
      const entries = screen.getByTestId("battle-log-entries") as HTMLOListElement;
      expect(entries.scrollTop).toBe(480);

      entries.scrollTop = 120;
      rerender(<BattleScreen viewModel={viewModel} logEntries={[...LOG_ENTRIES, { sequence: 2, message: "CPU drew a card.", type: "card.drawn", side: "cpu" }]} cpuStatus="idle" onReturnToPreparation={vi.fn()} onReturnToMenu={vi.fn()} onEndPlayPhase={vi.fn()} onRematch={vi.fn()} onQuitBattle={vi.fn()} />);
      expect(entries.scrollTop).toBe(120);
    } finally {
      if (scrollHeightDescriptor) Object.defineProperty(HTMLOListElement.prototype, "scrollHeight", scrollHeightDescriptor);
      else delete (HTMLOListElement.prototype as { scrollHeight?: number }).scrollHeight;
    }
  });

  it("opens an inspectable source-card detail from an effect log entry", () => {
    const viewModel = projectPublicBattleView(createBattleScreenState());
    const effectLogEntries: readonly BattleLogEntry[] = [{
      sequence: 2,
      message: "A card effect dealt damage.",
      type: "creature.damaged",
      side: "player",
      sourceCard: {
        instanceId: "effect-source",
        catalogCardId: "AK-016",
        name: "Azure Sage",
        type: "creature",
        attribute: "water",
        controllerSide: "player",
        currentAttack: 2,
        currentHp: 3,
        maxHp: 3,
        movement: 1,
        effectText: "On summon: Draw a card."
      }
    }];
    render(<BattleScreen viewModel={viewModel} logEntries={effectLogEntries} cpuStatus="idle" onReturnToPreparation={vi.fn()} onReturnToMenu={vi.fn()} onEndPlayPhase={vi.fn()} onRematch={vi.fn()} onQuitBattle={vi.fn()} />);

    fireEvent.click(screen.getByTestId("battle-log-toggle"));
    const source = screen.getByTestId("battle-log-effect-source-2");
    expect(source).toHaveTextContent("Azure Sage");
    fireEvent.click(source);
    expect(screen.getByTestId("battle-card-detail-popover")).toHaveTextContent("Azure Sage");

    fireEvent.click(source);
    expect(screen.queryByTestId("battle-card-detail-popover")).not.toBeInTheDocument();

    fireEvent.click(source);
    fireEvent.pointerDown(document.body);
    expect(screen.queryByTestId("battle-card-detail-popover")).not.toBeInTheDocument();
  });

  it("localizes board and card accessible names, including stats and ownership", () => {
    const viewModel = projectPublicBattleView(createBattleScreenState());
    const occupied = viewModel.boardSquares.find((square) => square.occupant);
    if (!occupied?.occupant) throw new Error("Expected an occupied board square fixture.");
    const { rerender } = render(<BattleScreen viewModel={viewModel} locale="ja" logEntries={LOG_ENTRIES} cpuStatus="idle" onReturnToPreparation={vi.fn()} onReturnToMenu={vi.fn()} onEndPlayPhase={vi.fn()} onRematch={vi.fn()} onQuitBattle={vi.fn()} />);
    const japaneseSquare = screen.getByTestId(`battle-square-${occupied.coordinate.column}-${occupied.coordinate.row}`);
    expect(japaneseSquare).toHaveAccessibleName(new RegExp(`列 ${occupied.coordinate.column}、行 ${occupied.coordinate.row}`));
    expect(japaneseSquare).toHaveAccessibleName(
      new RegExp(`配置カード ${escapeRegExp(occupied.occupant.name)}`)
    );
    const japaneseCard = screen.getByTestId(`battle-board-card-${occupied.occupant.instanceId}`);
    expect(japaneseCard).toHaveAccessibleName(new RegExp(`ATK ${occupied.occupant.currentAttack}`));
    expect(japaneseCard).toHaveAccessibleName(new RegExp(`コスト ${occupied.occupant.currentCost}`));
    expect(japaneseCard).toHaveAccessibleName(/状態 使用可能/);
    expect(japaneseCard).toHaveAccessibleName(/操作プレイヤー/);

    rerender(<BattleScreen viewModel={viewModel} locale="en" logEntries={LOG_ENTRIES} cpuStatus="idle" onReturnToPreparation={vi.fn()} onReturnToMenu={vi.fn()} onEndPlayPhase={vi.fn()} onRematch={vi.fn()} onQuitBattle={vi.fn()} />);
    expect(screen.getByTestId(`battle-square-${occupied.coordinate.column}-${occupied.coordinate.row}`)).toHaveAccessibleName(new RegExp(`Column ${occupied.coordinate.column}, row ${occupied.coordinate.row}`));
    expect(screen.getByTestId(`battle-board-card-${occupied.occupant.instanceId}`)).toHaveAccessibleName(new RegExp(`Cost ${occupied.occupant.currentCost}`));
    expect(screen.getByTestId(`battle-board-card-${occupied.occupant.instanceId}`)).toHaveAccessibleName(/Status Available/);
    expect(screen.getByTestId(`battle-board-card-${occupied.occupant.instanceId}`)).toHaveAccessibleName(/controlled by/);
  });

  it("opens detail on touch without issuing the follow-up click command", () => {
    const viewModel = projectPublicBattleView(createBattleScreenState());
    const onHandCardIntent = vi.fn();
    const onBoardCreatureIntent = vi.fn();
    render(<BattleScreen viewModel={viewModel} logEntries={LOG_ENTRIES} cpuStatus="idle" onReturnToPreparation={vi.fn()} onReturnToMenu={vi.fn()} onEndPlayPhase={vi.fn()} onHandCardIntent={onHandCardIntent} onBoardCreatureIntent={onBoardCreatureIntent} onRematch={vi.fn()} onQuitBattle={vi.fn()} />);
    const handCard = screen.getByTestId(`battle-hand-card-${viewModel.playerHand[0]!.instanceId}`);
    fireEvent.pointerUp(handCard, { pointerType: "touch" });
    fireEvent.click(handCard);
    expect(screen.getByTestId("battle-card-detail-popover")).toBeInTheDocument();
    expect(onHandCardIntent).not.toHaveBeenCalled();
    const occupied = viewModel.boardSquares.find((square) => square.occupant)!;
    const square = screen.getByTestId(`battle-square-${occupied.coordinate.column}-${occupied.coordinate.row}`);
    fireEvent.pointerUp(square, { pointerType: "touch" });
    fireEvent.click(square);
    expect(onBoardCreatureIntent).not.toHaveBeenCalled();
  });

  it("keeps only explicit phase ending and preserves CPU and result presentation", () => {
    const state = createBattleScreenState();
    const viewModel = projectPublicBattleView(state);
    const onEndPlayPhase = vi.fn();
    const { rerender } = renderBattleScreen(viewModel, {
      cpuStatus: "thinking",
      onEndPlayPhase
    });

    expect(screen.queryByTestId("battle-action-panel")).not.toBeInTheDocument();
    expect(screen.queryByTestId("battle-command-confirm-button")).not.toBeInTheDocument();
    expect(screen.queryByTestId("battle-command-cancel-button")).not.toBeInTheDocument();
    expect(screen.getByTestId("battle-cpu-status-overlay")).toHaveTextContent("CPU thinking");

    const endButton = screen.getByTestId("battle-end-play-phase-button");
    expect(endButton).toBeEnabled();
    fireEvent.click(endButton);
    expect(onEndPlayPhase).toHaveBeenCalledTimes(1);

    const terminalView = projectPublicBattleView({
      ...state,
      phase: "terminal",
      terminalResult: {
        winner: "player",
        loser: "cpu",
        reason: "base-destroyed",
        turnNumber: 4,
        elapsedSeconds: 20,
        finalEventSequence: 12
      }
    });

    rerender(
      <BattleScreen
        viewModel={terminalView}
        logEntries={LOG_ENTRIES}
        cpuStatus="completed"
        onReturnToPreparation={vi.fn()}
        onReturnToMenu={vi.fn()}
        onEndPlayPhase={onEndPlayPhase}
        onRematch={vi.fn()}
        onQuitBattle={vi.fn()}
      />
    );

    expect(screen.getByTestId("battle-result-overlay")).toHaveTextContent("勝利");
    expect(screen.getByTestId("battle-result-reason")).toHaveTextContent("敵拠点を破壊");
    expect(screen.getByTestId("battle-rematch-button")).toBeEnabled();
    expect(screen.getByTestId("battle-result-return-button")).toBeEnabled();
    expect(screen.getByTestId("battle-end-play-phase-button")).toBeDisabled();
    expect(screen.getByTestId("battle-square-3-1")).toBeDisabled();
    expect(
      screen.getByTestId(
        `battle-hand-card-${terminalView.playerHand[0]!.instanceId}`
      )
    ).toBeDisabled();
  });

  it("presents a battle event, animates its board target, and locks battle input during playback", () => {
    const viewModel = projectPublicBattleView(createBattleScreenState());
    const target = viewModel.boardSquares.find((square) => square.occupant)?.occupant;
    if (!target) throw new Error("Expected a board creature.");
    const damageEvent = {
      sequence: 99,
      type: "creature.damaged" as const,
      side: "cpu" as const,
      instanceId: "cpu-attacker",
      message: "CPU dealt 2 damage.",
      data: { targetId: target.instanceId, damage: 2 }
    };

    const { rerender } = render(
      <BattleScreen viewModel={viewModel} locale="ja" logEntries={LOG_ENTRIES} cpuStatus="executing"
        animationEvent={damageEvent} isAnimating onReturnToPreparation={vi.fn()} onReturnToMenu={vi.fn()}
        onEndPlayPhase={vi.fn()} onRematch={vi.fn()} onQuitBattle={vi.fn()} />
    );

    expect(screen.getByTestId("battle-event-banner")).toHaveTextContent("ダメージ");
    const targetCard = screen.getByTestId(`battle-board-card-${target.instanceId}`);
    expect(targetCard).toHaveClass("battle-card--anim-damage");
    expect(screen.getByTestId("battle-end-play-phase-button")).toBeDisabled();
    expect(targetCard.closest(".battle-square")).toHaveClass("battle-square--anim-damage");

    rerender(
      <BattleScreen viewModel={viewModel} locale="ja" logEntries={LOG_ENTRIES} cpuStatus="idle"
        onReturnToPreparation={vi.fn()} onReturnToMenu={vi.fn()} onEndPlayPhase={vi.fn()} onRematch={vi.fn()} onQuitBattle={vi.fn()} />
    );
    expect(screen.queryByTestId("battle-event-banner")).not.toBeInTheDocument();
    expect(screen.getByTestId("battle-end-play-phase-button")).toBeEnabled();
  });

  it("keeps the current attacker highlighted until the attack phase ends", () => {
    const viewModel = projectPublicBattleView(createBattleScreenState());
    const attacker = viewModel.boardSquares.find((square) => square.occupant)?.occupant;
    if (!attacker) throw new Error("Expected a board creature.");
    const attackerStarted = {
      sequence: 100,
      type: "attack.attacker-started" as const,
      instanceId: attacker.instanceId,
      message: "Creature started attacking."
    };
    const damageEvent = {
      sequence: 101,
      type: "creature.damaged" as const,
      instanceId: "other-creature",
      message: "Creature took damage.",
      data: { targetId: "other-creature", damage: 1 }
    };
    const phaseEnded = {
      sequence: 102,
      type: "attack.phase-ended" as const,
      message: "Attack phase ended."
    };

    expect(activeAttackerForEvent(undefined, attackerStarted)).toBe(attacker.instanceId);
    expect(activeAttackerForEvent(attacker.instanceId, damageEvent)).toBe(attacker.instanceId);
    expect(activeAttackerForEvent(attacker.instanceId, phaseEnded)).toBeUndefined();

    const { rerender } = renderBattleScreen(viewModel, {
      activeAttackerInstanceId: attacker.instanceId
    });
    expect(screen.getByTestId(`battle-board-card-${attacker.instanceId}`)).toHaveClass(
      "battle-card--attacking"
    );

    rerender(
      <BattleScreen viewModel={viewModel} logEntries={LOG_ENTRIES} cpuStatus="idle"
        onReturnToPreparation={vi.fn()} onReturnToMenu={vi.fn()} onEndPlayPhase={vi.fn()} onRematch={vi.fn()} onQuitBattle={vi.fn()} />
    );
    expect(screen.getByTestId(`battle-board-card-${attacker.instanceId}`)).not.toHaveClass(
      "battle-card--attacking"
    );
  });

  it("keeps a lethally damaged creature visible at zero HP until its destruction event", () => {
    const viewModel = projectPublicBattleView(createBattleScreenState());
    const targetSquare = viewModel.boardSquares.find((square) => square.occupant);
    if (!targetSquare?.occupant) throw new Error("Expected a board creature.");
    const target = targetSquare.occupant;
    const destroyedView = {
      ...viewModel,
      boardSquares: viewModel.boardSquares.map((square) =>
        square.key === targetSquare.key ? { ...square, occupant: undefined } : square
      )
    };
    const damageEvent = {
      sequence: 100,
      type: "creature.damaged" as const,
      instanceId: "cpu-attacker",
      message: "CPU dealt lethal damage.",
      data: { targetId: target.instanceId, damage: target.currentHp ?? 1, remainingHp: 0 }
    };
    const { rerender } = render(
      <BattleScreen viewModel={destroyedView} logEntries={LOG_ENTRIES} cpuStatus="idle" animationEvent={damageEvent}
        defeatedCreature={{ squareKey: targetSquare.key, card: { ...target, currentHp: 0 } }}
        onReturnToPreparation={vi.fn()} onReturnToMenu={vi.fn()} onEndPlayPhase={vi.fn()} onRematch={vi.fn()} onQuitBattle={vi.fn()} />
    );

    expect(screen.getByTestId(`battle-board-card-${target.instanceId}`)).toHaveTextContent("HP 0");
    expect(screen.getByTestId(`battle-square-${targetSquare.coordinate.column}-${targetSquare.coordinate.row}`)).toHaveClass("battle-square--anim-damage");

    const destroyedEvent = {
      sequence: 101,
      type: "creature.destroyed" as const,
      instanceId: target.instanceId,
      message: "Creature was destroyed.",
      data: { previousColumn: targetSquare.coordinate.column, previousRow: targetSquare.coordinate.row }
    };
    const destroyPresentation = defeatedCreatureFor(destroyedEvent, viewModel, destroyedView);

    expect(destroyPresentation).toMatchObject({ squareKey: targetSquare.key, card: { instanceId: target.instanceId, currentHp: 0 } });

    rerender(
      <BattleScreen viewModel={viewModel} logEntries={LOG_ENTRIES} cpuStatus="idle"
        animationEvent={destroyedEvent} defeatedCreature={destroyPresentation} destroyedCreatureInstanceIds={[target.instanceId]}
        onReturnToPreparation={vi.fn()} onReturnToMenu={vi.fn()} onEndPlayPhase={vi.fn()} onRematch={vi.fn()} onQuitBattle={vi.fn()} />
    );
    expect(screen.getByTestId(`battle-board-card-${target.instanceId}`)).toHaveClass("battle-card--anim-destroy");
    expect(screen.getByTestId(`battle-square-${targetSquare.coordinate.column}-${targetSquare.coordinate.row}`)).toHaveClass("battle-square--anim-destroy");

    rerender(
      <BattleScreen viewModel={viewModel} logEntries={LOG_ENTRIES} cpuStatus="idle" destroyedCreatureInstanceIds={[target.instanceId]}
        onReturnToPreparation={vi.fn()} onReturnToMenu={vi.fn()} onEndPlayPhase={vi.fn()} onRematch={vi.fn()} onQuitBattle={vi.fn()} />
    );
    expect(screen.queryByTestId(`battle-board-card-${target.instanceId}`)).not.toBeInTheDocument();
  });

  it("localizes terminal result labels, reason, and actions", () => {
    const state = createBattleScreenState();
    const terminalView = projectPublicBattleView({
      ...state,
      phase: "terminal",
      terminalResult: {
        winner: "cpu",
        loser: "player",
        reason: "deck-out",
        turnNumber: 4,
        elapsedSeconds: 20,
        finalEventSequence: 12
      }
    });

    const { rerender } = renderBattleScreen(terminalView, { locale: "ja" });
    expect(screen.getByTestId("battle-result-overlay")).toHaveTextContent("敗北");
    expect(screen.getByTestId("battle-result-reason")).toHaveTextContent("理由: 相手がカードを引けない");
    expect(screen.getByTestId("battle-rematch-button")).toHaveTextContent("再戦");
    expect(screen.getByTestId("battle-result-return-button")).toHaveTextContent("戻る");

    rerender(<BattleScreen viewModel={terminalView} locale="en" logEntries={LOG_ENTRIES} cpuStatus="completed" onReturnToPreparation={vi.fn()} onReturnToMenu={vi.fn()} onEndPlayPhase={vi.fn()} onRematch={vi.fn()} onQuitBattle={vi.fn()} />);
    expect(screen.getByTestId("battle-result-overlay")).toHaveTextContent("Defeat");
    expect(screen.getByTestId("battle-result-reason")).toHaveTextContent("Reason: Opponent could not draw");
    expect(screen.getByTestId("battle-rematch-button")).toHaveTextContent("Rematch");
  });

  it("explains resignation from the viewing player's perspective", () => {
    const state = createBattleScreenState();
    const selfRetired = projectPublicBattleView({
      ...state,
      phase: "terminal",
      terminalResult: {
        winner: "cpu",
        loser: "player",
        reason: "quit",
        turnNumber: 4,
        elapsedSeconds: 20,
        finalEventSequence: 12
      }
    });
    const opponentRetired = projectPublicBattleView({
      ...state,
      phase: "terminal",
      terminalResult: {
        winner: "player",
        loser: "cpu",
        reason: "quit",
        turnNumber: 4,
        elapsedSeconds: 20,
        finalEventSequence: 12
      }
    });
    const { rerender } = renderBattleScreen(selfRetired, { locale: "ja" });
    expect(screen.getByTestId("battle-result-reason")).toHaveTextContent("理由: あなたがリタイア");

    rerender(<BattleScreen viewModel={opponentRetired} locale="ja" logEntries={LOG_ENTRIES} cpuStatus="completed" onReturnToPreparation={vi.fn()} onReturnToMenu={vi.fn()} onEndPlayPhase={vi.fn()} onRematch={vi.fn()} onQuitBattle={vi.fn()} />);
    expect(screen.getByTestId("battle-result-reason")).toHaveTextContent("理由: 相手がリタイア");
  });

  it("keeps directional focus results inside the projected topology", () => {
    const squares = projectPublicBattleView(createBattleScreenState()).boardSquares;
    const directions: readonly BoardFocusDirection[] = [
      "ArrowLeft",
      "ArrowRight",
      "ArrowUp",
      "ArrowDown"
    ];
    const squareKeys = new Set(squares.map((square) => square.key));

    fc.assert(
      fc.property(
        canonicalBoardCoordinateArbitrary,
        fc.constantFrom(...directions),
        (coordinate, direction) => {
          const currentKey = coordinateKey(coordinate);
          const result = getNextBoardFocusKey(squares, currentKey, direction);

          expect(squareKeys.has(result)).toBe(true);
        }
      ),
      { numRuns: 60 }
    );
  });

  it("renders selection, direct switching, exact candidates, destination, and cancellation", () => {
    const state = createBattleScreenState();
    const viewModel = projectPublicBattleView(state);
    const creatures = viewModel.playerHand.filter(
      (card) => card.type === "creature" && card.isActionable
    );
    const spell = viewModel.playerHand.find((card) => card.type === "spell");

    if (creatures.length < 2 || !spell) {
      throw new Error("Expected two actionable creatures and one spell.");
    }

    render(<BattleScreenInteractionHarness state={state} />);

    const firstCard = screen.getByTestId(`battle-hand-card-${creatures[0].instanceId}`);
    const secondCard = screen.getByTestId(`battle-hand-card-${creatures[1].instanceId}`);
    fireEvent.click(firstCard);

    expect(firstCard).toHaveAttribute("aria-pressed", "true");
    expect(document.querySelectorAll(".battle-square--candidate")).toHaveLength(6);
    expect(screen.queryByTestId("battle-summon-confirm-button")).not.toBeInTheDocument();
    expect(screen.getByTestId("battle-summon-cancel-button")).toBeEnabled();
    expect(screen.getByTestId("battle-end-play-phase-button")).toBeDisabled();

    fireEvent.click(screen.getByTestId("battle-square-5-8"));
    expect(document.querySelectorAll(".battle-square--selected")).toHaveLength(0);

    fireEvent.click(screen.getByTestId("battle-square-3-9"));
    expect(screen.getByTestId("battle-square-3-9")).toHaveClass(
      "battle-square--selected"
    );
    expect(screen.queryByTestId("battle-summon-confirm-button")).not.toBeInTheDocument();

    fireEvent.click(secondCard);
    expect(secondCard).toHaveAttribute("aria-pressed", "true");
    expect(firstCard).toHaveAttribute("aria-pressed", "false");
    expect(document.querySelectorAll(".battle-square--selected")).toHaveLength(0);
    expect(screen.queryByTestId("battle-summon-confirm-button")).not.toBeInTheDocument();

    fireEvent.click(secondCard);
    expect(screen.queryByTestId("battle-summon-confirm-button")).not.toBeInTheDocument();
    expect(document.querySelectorAll(".battle-square--candidate")).toHaveLength(0);
    expect(screen.getByTestId("battle-end-play-phase-button")).toBeEnabled();

    fireEvent.click(firstCard);
    fireEvent.click(screen.getByTestId("battle-summon-cancel-button"));
    expect(screen.queryByTestId("battle-summon-cancel-button")).not.toBeInTheDocument();
    expect(screen.getByTestId(`battle-hand-card-${spell.instanceId}`)).toHaveAttribute("aria-disabled", "false");
  });

  it("opens the graveyard for effect selection and distinguishes lane and selected targets", () => {
    const state = createBattleScreenState();
    const viewModel = projectPublicBattleView(state);
    const graveyardCard = { ...viewModel.playerHand[0]!, instanceId: "grave-1" };
    const onBoardSquareIntent = vi.fn();
    const onEffectCandidateIntent = vi.fn();
    const interaction = {
      kind: "selecting-effect" as const,
      selectedHandInstanceId: viewModel.playerHand[0]?.instanceId,
      candidateDestinationKeys: ["5:5", "6:1"],
      effectCandidates: [
        { kind: "creature" as const, id: "board-card", label: "Creature", selected: false },
        { kind: "base" as const, id: "cpu-base", label: "Base", selected: false },
        { kind: "lane" as const, id: "left", label: "Left lane", selected: true },
        { kind: "coordinate" as const, id: "5:5", label: "Cell", selected: false },
        { kind: "graveyard" as const, id: "grave-1", label: "Graveyard card", selected: false }
      ],
      maximumTargets: 1,
      movementPathSteps: [],
      confirmEnabled: false,
      cancelEnabled: true,
      undoEnabled: false,
      endPlayPhaseEnabled: false,
      instruction: "Select a target."
    };

    render(
      <BattleScreen
        viewModel={{ ...viewModel, playerGraveyard: [graveyardCard] }}
        interaction={interaction}
        logEntries={LOG_ENTRIES}
        cpuStatus="idle"
        onReturnToPreparation={vi.fn()}
        onReturnToMenu={vi.fn()}
        onEndPlayPhase={vi.fn()}
        onBoardSquareIntent={onBoardSquareIntent}
        onEffectCandidateIntent={onEffectCandidateIntent}
        onRematch={vi.fn()}
        onQuitBattle={vi.fn()}
      />
    );

    expect(screen.getByTestId("battle-effect-selection-count")).toHaveTextContent("Selected 1 / 1");
    expect(screen.queryByTestId("battle-square-3-1")).not.toHaveClass("battle-square--lane-candidate");
    expect(screen.getByTestId("battle-lane-overlay-left")).toHaveAttribute("data-selected", "true");
    expect(screen.getByTestId("battle-lane-overlay-left")).toHaveClass("battle-lane-overlay--selected");
    fireEvent.click(screen.getByTestId("battle-effect-open-graveyard-button"));
    expect(screen.getByTestId("battle-player-graveyard-dialog")).toBeInTheDocument();
    expect(screen.getByTestId(`battle-graveyard-artwork-${graveyardCard.catalogCardId}`)).toBeInTheDocument();
    fireEvent.pointerEnter(screen.getByTestId("battle-graveyard-card-grave-1"));
    expect(screen.getByTestId("battle-card-detail-popover")).toHaveTextContent(graveyardCard.name);
    fireEvent.click(screen.getByTestId("battle-graveyard-card-grave-1"));
    expect(onEffectCandidateIntent).toHaveBeenCalledWith("grave-1");

    fireEvent.click(screen.getByTestId("battle-square-4-5"));
    expect(onBoardSquareIntent).toHaveBeenCalledWith({ column: 4, row: 5 });
    expect(screen.queryByTestId("battle-effect-confirm-button")).not.toBeInTheDocument();
  });

  it("renders an ordered reversible movement draft with exactly one provisional creature", () => {
    const state = createBattleScreenState();
    const viewModel = projectPublicBattleView(state);
    const boardCreature = viewModel.boardSquares.find((square) => square.occupant)
      ?.occupant;
    const handCreature = viewModel.playerHand.find(
      (card) => card.type === "creature" && card.isActionable
    );
    if (!boardCreature || !handCreature) {
      throw new Error("Expected actionable board and hand creatures.");
    }

    const { container } = render(<BattleScreenInteractionHarness state={state} />);
    const boardCardTestId = `battle-board-card-${boardCreature.instanceId}`;

    fireEvent.click(screen.getByTestId(`battle-hand-card-${handCreature.instanceId}`));
    expect(screen.getByTestId("battle-summon-cancel-button")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId(boardCardTestId));

    expect(screen.queryByTestId("battle-move-confirm-button")).not.toBeInTheDocument();
    expect(screen.getByTestId("battle-move-undo-button")).toBeDisabled();
    expect(screen.getByTestId("battle-move-cancel-button")).toBeEnabled();
    expect(screen.getByTestId("battle-end-play-phase-button")).toBeDisabled();
    expect(container.querySelectorAll(".battle-square--candidate")).toHaveLength(8);
    expect(screen.getByTestId("battle-movement-budget")).toHaveTextContent(
      "Movement 0 / 3"
    );

    fireEvent.click(screen.getByTestId("battle-square-9-9"));
    expect(container.querySelectorAll(".battle-square--candidate")).toHaveLength(8);

    fireEvent.click(screen.getByTestId("battle-square-5-5"));
    expect(screen.getByTestId("battle-square-4-5")).not.toContainElement(
      screen.getByTestId(boardCardTestId)
    );
    expect(screen.getByTestId("battle-square-5-5")).toContainElement(
      screen.getByTestId(boardCardTestId)
    );
    expect(container.querySelectorAll(`[data-testid="${boardCardTestId}"]`)).toHaveLength(1);
    expect(screen.getAllByTestId("battle-movement-origin-marker")).toHaveLength(1);
    expect(screen.getByTestId("battle-movement-step-1")).toHaveTextContent("1");
    expect(screen.queryByTestId("battle-move-confirm-button")).not.toBeInTheDocument();
    expect(screen.getByTestId("battle-move-undo-button")).toBeEnabled();

    fireEvent.click(screen.getByTestId("battle-square-4-5"));
    expect(screen.getByTestId("battle-square-4-5")).toContainElement(
      screen.getByTestId(boardCardTestId)
    );
    expect(screen.getByTestId("battle-movement-step-2")).toHaveTextContent("2");

    fireEvent.click(screen.getByTestId("battle-square-5-5"));
    expect(screen.getByTestId("battle-square-5-5")).toContainElement(
      screen.getByTestId(boardCardTestId)
    );
    expect(screen.getByTestId("battle-movement-step-3")).toHaveTextContent("3");
    expect(screen.getByTestId("battle-movement-budget")).toHaveTextContent(
      "Movement 3 / 3"
    );
    expect(container.querySelectorAll(".battle-square--candidate")).toHaveLength(0);

    fireEvent.click(screen.getByTestId("battle-move-undo-button"));
    expect(screen.queryByTestId("battle-movement-step-3")).not.toBeInTheDocument();
    expect(screen.getByTestId("battle-square-4-5")).toContainElement(
      screen.getByTestId(boardCardTestId)
    );
    expect(screen.getByTestId("battle-movement-budget")).toHaveTextContent(
      "Movement 2 / 3"
    );

    fireEvent.click(screen.getByTestId("battle-move-cancel-button"));
    expect(screen.queryByTestId("battle-move-cancel-button")).not.toBeInTheDocument();
    expect(screen.getByTestId("battle-square-4-5")).toContainElement(
      screen.getByTestId(boardCardTestId)
    );
    expect(container.querySelectorAll(".battle-square--candidate")).toHaveLength(0);

    fireEvent.click(screen.getByTestId(boardCardTestId));
    fireEvent.click(screen.getByTestId(boardCardTestId));
    expect(screen.queryByTestId("battle-move-cancel-button")).not.toBeInTheDocument();
  });

  it("cancels a controller-owned pending summon on Escape and cleans up the listener", async () => {
    const state = createBattleScreenState();
    battleSetupMocks.loadBattlePreparation.mockResolvedValue({
      deckOptions: [
        {
          deckId: "deck-controller",
          name: "Controller Deck",
          cardCount: 40,
          battleReady: true,
          updatedAt: "2026-08-01T00:00:00.000Z"
        }
      ],
      playerDeckId: "deck-controller",
      cpuDeckId: "deck-controller",
      firstPlayerMode: "player-first",
      loading: false
    });
    battleSetupMocks.startBattle.mockResolvedValue({ ok: true, state, events: [] });
    const removeListener = vi.spyOn(window, "removeEventListener");
    const { result, unmount } = renderHook(() =>
      useBattleController({
        catalog: validCatalogSnapshotFixture,
        repository: {} as DeckRepository,
        onReturnToMenu: vi.fn()
      })
    );

    await waitFor(() => {
      expect(result.current.viewModel.kind).toBe("preparation");
      if (result.current.viewModel.kind === "preparation") {
        expect(result.current.viewModel.preparation.loading).toBe(false);
      }
    });
    await act(async () => {
      await result.current.actions.startBattle();
    });

    if (result.current.viewModel.kind !== "battle") {
      throw new Error("Expected a started battle controller.");
    }
    const spell = result.current.viewModel.publicView.playerHand.find(
      (card) => card.type === "spell" && card.isActionable
    );
    if (!spell) {
      throw new Error("Expected an actionable spell.");
    }
    if (spell.attribute === "unknown") {
      throw new Error("Expected the spell fixture to have an attribute.");
    }
    act(() => result.current.actions.selectHandCard(spell.instanceId));
    await waitFor(() => {
      if (result.current.viewModel.kind !== "battle") {
        throw new Error("Expected an active battle.");
      }
      expect(result.current.viewModel.interaction.kind).toBe("selecting-effect");
    });
    act(() => result.current.actions.cancelInteraction());
    if (result.current.viewModel.kind === "battle") {
      expect(result.current.viewModel.interaction.kind).toBe("idle");
      expect(result.current.viewModel.publicView.playerHand).toEqual(expect.arrayContaining([expect.objectContaining({ instanceId: spell.instanceId })]));
    }

    const creature = result.current.viewModel.publicView.playerHand.find(
      (card) => card.type === "creature" && card.isActionable
    );
    if (!creature) {
      throw new Error("Expected an actionable creature.");
    }

    act(() => result.current.actions.selectHandCard(creature.instanceId));
    expect(result.current.viewModel.kind).toBe("battle");
    if (result.current.viewModel.kind === "battle") {
      expect(result.current.viewModel.interaction.kind).toBe("selecting-summon");
    }

    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => {
      if (result.current.viewModel.kind === "battle") {
        expect(result.current.viewModel.interaction.kind).toBe("idle");
      }
    });
    expect(removeListener).toHaveBeenCalledWith("keydown", expect.any(Function));

    unmount();
    removeListener.mockRestore();
  });

  it("ends the player's battle as a resignation", async () => {
    const state = createBattleScreenState();
    battleSetupMocks.loadBattlePreparation.mockResolvedValue({
      deckOptions: [{ deckId: "deck-resign", name: "Resign Deck", cardCount: 40, battleReady: true, updatedAt: "2026-08-01T00:00:00.000Z" }],
      playerDeckId: "deck-resign",
      cpuDeckId: "deck-resign",
      firstPlayerMode: "player-first",
      loading: false
    });
    battleSetupMocks.startBattle.mockResolvedValue({ ok: true, state, events: [] });
    const { result } = renderHook(() => useBattleController({
      catalog: validCatalogSnapshotFixture,
      repository: {} as DeckRepository,
      onReturnToMenu: vi.fn()
    }));

    await waitFor(() => expect(result.current.viewModel.kind).toBe("preparation"));
    await act(async () => {
      await result.current.actions.startBattle();
    });
    await waitFor(() => expect(result.current.viewModel.kind).toBe("battle"));
    await act(async () => {
      await result.current.actions.resignBattle();
    });

    expect(result.current.viewModel).toMatchObject({
      kind: "battle",
      publicView: {
        phase: "terminal",
        terminalResult: {
          winner: "cpu",
          loser: "player",
          reason: "quit"
        }
      }
    });
  });

  it("submits online resignation through the remote battle transport", async () => {
    const state = createBattleScreenState();
    const terminalState: BattleState = {
      ...state,
      phase: "terminal",
      terminalResult: {
        winner: "cpu",
        loser: "player",
        reason: "quit",
        turnNumber: state.metadata.turnNumber,
        elapsedSeconds: state.metadata.elapsedSeconds,
        finalEventSequence: state.eventCursor + 1
      }
    };
    const submitCommand = vi.fn().mockResolvedValue({
      ok: true,
      state: terminalState,
      events: [{
        sequence: state.eventCursor + 1,
        type: "battle.ended",
        side: "cpu",
        message: "CPU won after the opponent quit."
      }]
    });
    const onReturnToOnlinePreparation = vi.fn();
    const { result } = renderHook(() => useBattleController({
      catalog: validCatalogSnapshotFixture,
      repository: {} as DeckRepository,
      onReturnToMenu: vi.fn(),
      onlineBattle: {
        initialState: state,
        initialEvents: [],
        submitCommand
      },
      onReturnToOnlinePreparation
    }));

    await act(async () => {
      await result.current.actions.resignBattle();
    });

    expect(submitCommand).toHaveBeenCalledWith({ type: "resign", side: "player" });
    expect(result.current.viewModel).toMatchObject({
      kind: "battle",
      publicView: { terminalResult: { winner: "cpu", loser: "player", reason: "quit" } }
    });
    act(() => result.current.actions.quitBattle());
    expect(onReturnToOnlinePreparation).toHaveBeenCalledTimes(1);
  });

  it("resolves a no-target summon when its destination is clicked", async () => {
    const initialState = createBattleScreenState();
    const creature = Object.values(initialState.cardInstances).find(
      (card) =>
        card.ownerSide === "player" &&
        card.zone === "hand" &&
        card.type === "creature"
    );
    if (!creature) throw new Error("Expected a player creature in hand.");
    const state: BattleState = {
      ...initialState,
      cardInstances: {
        ...initialState.cardInstances,
        [creature.instanceId]: {
          ...creature,
          catalogCardId: "AK-001",
          effectIds: [],
          effectText: "なし"
        }
      }
    };
    battleSetupMocks.loadBattlePreparation.mockResolvedValue({
      deckOptions: [{ deckId: "deck-summon-controller", name: "Summon Controller Deck", cardCount: 40, battleReady: true, updatedAt: "2026-08-01T00:00:00.000Z" }],
      playerDeckId: "deck-summon-controller",
      cpuDeckId: "deck-summon-controller",
      firstPlayerMode: "player-first",
      loading: false
    });
    battleSetupMocks.startBattle.mockResolvedValue({ ok: true, state, events: [] });
    const { result } = renderHook(() => useBattleController({
      catalog: validCatalogSnapshotFixture,
      repository: {} as DeckRepository,
      onReturnToMenu: vi.fn()
    }));

    await waitFor(() => expect(result.current.viewModel.kind).toBe("preparation"));
    await act(async () => { await result.current.actions.startBattle(); });
    act(() => result.current.actions.selectHandCard(creature.instanceId));
    await waitFor(() => {
      if (result.current.viewModel.kind === "battle") {
        expect(result.current.viewModel.interaction.kind).toBe("selecting-summon");
      }
    });

    act(() => result.current.actions.selectBoardSquare({ column: 3, row: 9 }));
    await waitFor(() => {
      if (result.current.viewModel.kind !== "battle") {
        throw new Error("Expected an active battle.");
      }
      expect(result.current.viewModel.interaction.kind).toBe("idle");
      expect(result.current.viewModel.publicView.boardSquares.find(
        (square) => square.key === "3:9"
      )?.occupant).toMatchObject({ instanceId: creature.instanceId });
    });
  });

  it("resolves a summon effect when its board target is clicked", async () => {
    const initialState = createBattleScreenState();
    const source = Object.values(initialState.cardInstances).find(
      (card) => card.ownerSide === "player" && card.zone === "hand" && card.type === "creature"
    );
    const enemy = Object.values(initialState.cardInstances).find(
      (card) => card.ownerSide === "cpu"
    );
    if (!source || !enemy) throw new Error("Expected summon source and enemy fixtures.");
    const state = placeCreatureForTest({
      ...initialState,
      cardInstances: {
        ...initialState.cardInstances,
        [source.instanceId]: {
          ...source,
          catalogCardId: "AK-003",
          effectIds: ["AK-003.primary"],
          effectText: "召喚時：敵クリーチャーまたは攻撃可能な拠点1つを選択する。その対象に1ダメージを与える。"
        },
        [enemy.instanceId]: {
          ...enemy,
          type: "creature",
          attack: enemy.attack ?? 3,
          currentAttack: enemy.currentAttack ?? enemy.attack ?? 3,
          health: enemy.health ?? 4,
          currentHp: enemy.currentHp ?? enemy.health ?? 4,
          maxHp: enemy.maxHp ?? enemy.health ?? 4
        }
      }
    }, enemy.instanceId, "cpu", 5, 5);
    battleSetupMocks.loadBattlePreparation.mockResolvedValue({
      deckOptions: [{ deckId: "deck-effect-controller", name: "Effect Controller Deck", cardCount: 40, battleReady: true, updatedAt: "2026-08-01T00:00:00.000Z" }],
      playerDeckId: "deck-effect-controller",
      cpuDeckId: "deck-effect-controller",
      firstPlayerMode: "player-first",
      loading: false
    });
    battleSetupMocks.startBattle.mockResolvedValue({ ok: true, state, events: [] });
    const { result } = renderHook(() => useBattleController({
      catalog: validCatalogSnapshotFixture,
      repository: {} as DeckRepository,
      onReturnToMenu: vi.fn()
    }));

    await waitFor(() => expect(result.current.viewModel.kind).toBe("preparation"));
    await act(async () => { await result.current.actions.startBattle(); });
    act(() => result.current.actions.selectHandCard(source.instanceId));
    act(() => result.current.actions.selectBoardSquare({ column: 3, row: 9 }));
    await waitFor(() => {
      if (result.current.viewModel.kind === "battle") {
        expect(result.current.viewModel.interaction.kind).toBe("selecting-effect");
      }
    });

    act(() => result.current.actions.selectBoardSquare({ column: 5, row: 5 }));
    await waitFor(() => {
      if (result.current.viewModel.kind !== "battle") {
        throw new Error("Expected an active battle.");
      }
      expect(result.current.viewModel.interaction.kind).toBe("idle");
      expect(result.current.viewModel.publicView.boardSquares.find(
        (square) => square.key === "3:9"
      )?.occupant).toMatchObject({ instanceId: source.instanceId });
    }, { timeout: 3_000 });
  });

  it("guards phase end, cancels movement on Escape, and resolves at the movement limit", async () => {
    const state = createBattleScreenState();
    battleSetupMocks.loadBattlePreparation.mockResolvedValue({
      deckOptions: [
        {
          deckId: "deck-movement-controller",
          name: "Movement Controller Deck",
          cardCount: 40,
          battleReady: true,
          updatedAt: "2026-08-01T00:00:00.000Z"
        }
      ],
      playerDeckId: "deck-movement-controller",
      cpuDeckId: "deck-movement-controller",
      firstPlayerMode: "player-first",
      loading: false
    });
    battleSetupMocks.startBattle.mockResolvedValue({ ok: true, state, events: [] });
    const { result } = renderHook(() =>
      useBattleController({
        catalog: validCatalogSnapshotFixture,
        repository: {} as DeckRepository,
        onReturnToMenu: vi.fn()
      })
    );

    await waitFor(() => {
      if (result.current.viewModel.kind === "preparation") {
        expect(result.current.viewModel.preparation.loading).toBe(false);
      }
    });
    await act(async () => {
      await result.current.actions.startBattle();
    });
    if (result.current.viewModel.kind !== "battle") {
      throw new Error("Expected a started battle controller.");
    }
    const creature = result.current.viewModel.publicView.boardSquares.find(
      (square) => square.occupant?.isActionable
    )?.occupant;
    if (!creature) {
      throw new Error("Expected an actionable board creature.");
    }

    act(() => result.current.actions.selectBoardCreature(creature.instanceId));
    await act(async () => {
      await result.current.actions.endPlayPhase();
    });
    if (result.current.viewModel.kind === "battle") {
      expect(result.current.viewModel.interaction).toMatchObject({
        kind: "selecting-move",
        issue: "Complete the pending selection or cancel it before ending the play phase."
      });
    }

    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => {
      if (result.current.viewModel.kind === "battle") {
        expect(result.current.viewModel.interaction.kind).toBe("idle");
      }
    });

    act(() => result.current.actions.selectBoardCreature(creature.instanceId));
    act(() => result.current.actions.selectBoardSquare({ column: 5, row: 5 }));
    act(() => result.current.actions.selectBoardSquare({ column: 4, row: 5 }));
    await act(async () => {
      result.current.actions.selectBoardSquare({ column: 5, row: 5 });
    });

    await waitFor(() => {
      if (result.current.viewModel.kind !== "battle") {
        throw new Error("Expected an active battle controller.");
      }
      expect(result.current.viewModel.interaction.kind).toBe("idle");
      expect(
        result.current.viewModel.publicView.boardSquares.find(
          (square) => square.key === "5:5"
        )?.occupant
      ).toMatchObject({ instanceId: creature.instanceId, movedThisTurn: true });
    }, { timeout: 2_000 });
  });
});

function BattleScreenInteractionHarness({ state }: { readonly state: BattleState }) {
  const [interaction, setInteraction] = useState<BattleInteractionState>(
    IDLE_BATTLE_INTERACTION
  );

  return (
    <BattleScreen
      viewModel={projectPublicBattleView(state)}
      interaction={projectBattleInteractionFromState(interaction, state)}
      logEntries={LOG_ENTRIES}
      cpuStatus="idle"
      onReturnToPreparation={vi.fn()}
      onReturnToMenu={vi.fn()}
      onEndPlayPhase={vi.fn()}
      onHandCardIntent={(instanceId) => {
        setInteraction((current) =>
          selectSummonHandCard(current, state, instanceId)
        );
      }}
      onBoardSquareIntent={(coordinate) => {
        setInteraction((current) =>
          current.kind === "selecting-move"
            ? selectMovementStep(current, state, coordinate)
            : selectSummonDestination(current, coordinate)
        );
      }}
      onBoardCreatureIntent={(instanceId) => {
        setInteraction((current) =>
          selectMovementCreature(current, state, instanceId)
        );
      }}
      onCancelInteraction={() => setInteraction(cancelBattleInteraction())}
      onUndoInteraction={() => {
        setInteraction((current) => undoMovementStep(current, state));
      }}
      onRematch={vi.fn()}
      onQuitBattle={vi.fn()}
    />
  );
}

function renderBattleScreen(
  viewModel: ReturnType<typeof projectPublicBattleView>,
  overrides: {
    readonly cpuStatus?: "idle" | "thinking" | "executing" | "completed" | "limit-reached";
    readonly onEndPlayPhase?: () => void;
    readonly onQuitBattle?: () => void;
    readonly locale?: "ja" | "en";
    readonly activeAttackerInstanceId?: string;
    readonly opponentName?: string;
  } = {}
) {
  return render(
    <BattleScreen
      viewModel={viewModel}
      logEntries={LOG_ENTRIES}
      cpuStatus={overrides.cpuStatus ?? "idle"}
      opponentName={overrides.opponentName}
      locale={overrides.locale}
      activeAttackerInstanceId={overrides.activeAttackerInstanceId}
      onReturnToPreparation={vi.fn()}
      onReturnToMenu={vi.fn()}
      onEndPlayPhase={overrides.onEndPlayPhase ?? vi.fn()}
      onRematch={vi.fn()}
      onQuitBattle={overrides.onQuitBattle ?? vi.fn()}
    />
  );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function createBattleScreenState(): BattleState {
  const sampled = fc.sample(battleStateArbitrary, {
    numRuns: 1,
    seed: 3003
  })[0];
  const playerIds = Object.values(sampled.cardInstances)
    .filter((card) => card.ownerSide === "player")
    .map((card) => card.instanceId);
  const handIds = playerIds.slice(0, 9);
  const boardId = playerIds[9] as string;
  const nextInstances: Record<string, BattleCardInstance> = {
    ...sampled.cardInstances
  };

  for (const [index, instanceId] of handIds.entries()) {
    const card = nextInstances[instanceId] as BattleCardInstance;
    nextInstances[instanceId] = {
      ...card,
      type: index === 0 ? "spell" : "creature",
      zone: "hand",
      position: undefined,
      // Keep the controller Escape fixture independent of the sampled card's
      // executable effect and cost. It only exercises casting a spell before
      // selecting a summon, so a no-effect, one-cost spell preserves an
      // actionable creature after the cast.
      currentCost: index === 0 ? 1 : Math.min(card.currentCost, 3),
      ...(index === 0
        ? {
            cost: 1,
            effectText: "なし",
            effectIds: [],
            attack: undefined,
            currentAttack: undefined,
            health: undefined,
            currentHp: undefined,
            maxHp: undefined
          }
        : {
            attack: card.attack ?? 3,
            currentAttack: card.currentAttack ?? card.attack ?? 3,
            health: card.health ?? 4,
            currentHp: card.currentHp ?? card.health ?? 4,
            maxHp: card.maxHp ?? card.health ?? 4,
            movement: Math.max(1, card.movement)
          })
    };
  }

  const boardCard = nextInstances[boardId] as BattleCardInstance;
  nextInstances[boardId] = {
    ...boardCard,
    type: "creature",
    zone: "board",
    position: { column: 4, row: 5 },
    attack: boardCard.attack ?? 3,
    currentAttack: boardCard.currentAttack ?? boardCard.attack ?? 3,
    health: boardCard.health ?? 4,
    currentHp: boardCard.currentHp ?? boardCard.health ?? 4,
    maxHp: boardCard.maxHp ?? boardCard.health ?? 4,
    movement: 3,
    summonedThisTurn: false,
    movedThisTurn: false
  };

  return {
    ...sampled,
    phase: "play",
    activeSide: "player",
    terminalResult: undefined,
    players: {
      ...sampled.players,
      player: {
        ...sampled.players.player,
        handZone: handIds,
        deckZone: sampled.players.player.deckZone.filter(
          (instanceId) => !handIds.includes(instanceId) && instanceId !== boardId
        ),
        currentPp: 10,
        maxPp: 10
      }
    },
    board: {
      squares: sampled.board.squares.map((square) =>
        square.coordinate.column === 4 && square.coordinate.row === 5
          ? { ...square, occupantId: boardId }
          : square
      )
    },
    cardInstances: nextInstances
  };
}

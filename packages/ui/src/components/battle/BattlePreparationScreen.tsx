import type { FirstPlayerMode, SavedDeckSummary } from "@ankake/domain";
import { localizeBattleReason, uiText } from "../../localization";
import { BackgroundScene } from "../BackgroundScene";

export interface BattlePreparationScreenViewModel {
  readonly deckOptions: readonly SavedDeckSummary[];
  readonly playerDeckId?: string;
  readonly cpuDeckId?: string;
  readonly firstPlayerMode: FirstPlayerMode;
  readonly loading: boolean;
  readonly error?: string;
}

export interface BattlePreparationScreenProps {
  readonly viewModel: BattlePreparationScreenViewModel;
  readonly startDisabledReason?: string;
  readonly onReturnToMenu: () => void;
  readonly onSelectPlayerDeck: (deckId: string) => void;
  readonly onSelectCpuDeck: (deckId: string) => void;
  readonly onFirstPlayerModeChange: (mode: FirstPlayerMode) => void;
  readonly onStartBattle: () => void;
  readonly locale?: "ja" | "en";
}

export function BattlePreparationScreen(props: BattlePreparationScreenProps) {
  const { viewModel } = props;
  const ja = props.locale === "ja";
  const battleReadyDecks = viewModel.deckOptions.filter((deck) => deck.battleReady);

  return (
    <main className="battle-prep-screen" data-testid="battle-preparation-screen">
      <BackgroundScene />
      <header className="battle-prep-header">
        <button className="battle-button battle-button--quiet" type="button" onClick={props.onReturnToMenu}>
          {uiText(props.locale, "battle.back")}
        </button>
        <div>
          <p className="battle-kicker">{uiText(props.locale, "menu.cpu-battle")}</p>
          <h1>{uiText(props.locale, "battle.preparation")}</h1>
        </div>
      </header>

      <section className="battle-prep-grid">
        <BattleDeckSelector
          label={uiText(props.locale, "battle.player-deck")}
          testId="battle-prep-player-deck-selector"
          deckId={viewModel.playerDeckId}
          decks={viewModel.deckOptions}
          onChange={props.onSelectPlayerDeck} locale={props.locale}
        />
        <BattleDeckSelector
          label={uiText(props.locale, "battle.cpu-deck")}
          testId="battle-prep-cpu-deck-selector"
          deckId={viewModel.cpuDeckId}
          decks={viewModel.deckOptions}
          onChange={props.onSelectCpuDeck} locale={props.locale}
        />
        <fieldset className="battle-panel battle-first-player" data-testid="battle-prep-first-player-mode">
          <legend>{uiText(props.locale, "battle.first-player")}</legend>
          <label>
            <input
              checked={viewModel.firstPlayerMode === "random"}
              name="first-player-mode"
              type="radio"
              onChange={() => props.onFirstPlayerModeChange("random")}
            />
            {uiText(props.locale, "battle.random")}
          </label>
          <label>
            <input
              checked={viewModel.firstPlayerMode === "player-first"}
              name="first-player-mode"
              type="radio"
              onChange={() => props.onFirstPlayerModeChange("player-first")}
            />
            {uiText(props.locale, "battle.player-first")}
          </label>
          <label>
            <input
              checked={viewModel.firstPlayerMode === "player-second"}
              name="first-player-mode"
              type="radio"
              onChange={() => props.onFirstPlayerModeChange("player-second")}
            />
            {uiText(props.locale, "battle.player-second")}
          </label>
        </fieldset>

        <section className="battle-panel battle-start-panel">
          <h2>{uiText(props.locale, "battle.start")}</h2>
          <p>{ja ? `対戦可能なデッキ: ${battleReadyDecks.length}` : `${battleReadyDecks.length} battle-ready deck(s) available.`}</p>
          {props.startDisabledReason ? (
            <p className="battle-warning" data-testid="battle-prep-error">
              {localizeBattleReason(props.locale, props.startDisabledReason)}
            </p>
          ) : null}
          {viewModel.error ? (
            <p className="battle-warning" data-testid="battle-prep-error">
              {localizeBattleReason(props.locale, viewModel.error)}
            </p>
          ) : null}
          <button
            className="battle-button battle-button--primary"
            data-testid="battle-prep-start-button"
            disabled={Boolean(props.startDisabledReason) || viewModel.loading}
            type="button"
            onClick={props.onStartBattle}
          >
            {viewModel.loading ? uiText(props.locale, "battle.loading") : uiText(props.locale, "battle.start-battle")}
          </button>
        </section>
      </section>
    </main>
  );
}

export interface BattleDeckSelectorProps {
  readonly label: string;
  readonly testId: string;
  readonly deckId?: string;
  readonly decks: readonly SavedDeckSummary[];
  readonly onChange: (deckId: string) => void;
  readonly locale?: "ja" | "en";
  readonly disabled?: boolean;
}

/** Shared native deck selector used by CPU and online battle preparation. */
export function BattleDeckSelector(props: BattleDeckSelectorProps) {
  return (
    <label className="battle-panel battle-deck-selector">
      <span>{props.label}</span>
      <select
        data-testid={props.testId}
        disabled={props.disabled}
        value={props.deckId ?? ""}
        onChange={(event) => props.onChange(event.currentTarget.value)}
      >
        <option value="" disabled>
          {uiText(props.locale, "battle.select-deck")}
        </option>
        {props.decks.map((deck) => (
          <option key={deck.deckId} disabled={!deck.battleReady} value={deck.deckId}>
            {deck.name} - {props.locale === "ja" ? `${deck.cardCount} 枚` : `${deck.cardCount} cards`}{deck.battleReady ? "" : ` - ${uiText(props.locale, "battle.not-ready")}`}
          </option>
        ))}
      </select>
    </label>
  );
}

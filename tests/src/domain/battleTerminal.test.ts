import {
  applyTerminalResult,
  createInitialBattleBoard,
  evaluateBattleTerminal,
  GameEngine,
  getBattleBaseById,
  placeCreatureForTest,
  resolveAttackPhase,
  resolveSimpleSpellEffect,
  updateBattleBase,
  type BattleCardInstance,
  type BattleState,
  type BattleTerminalResult
} from "@ankake/domain";
import fc from "fast-check";
import { battleStateArbitrary } from "../generators/battleGenerators";

describe("battle terminal rules", () => {
  it("does not overwrite an existing terminal result", () => {
    const state = sampleState();
    const existing: BattleTerminalResult = {
      winner: "cpu",
      loser: "player",
      reason: "quit",
      turnNumber: 4,
      elapsedSeconds: 90,
      finalEventSequence: 30
    };
    const terminalState = { ...state, phase: "terminal" as const, terminalResult: existing };

    expect(
      evaluateBattleTerminal(
        terminalState,
        { kind: "draw-failed", losingSide: "cpu" },
        50
      )
    ).toBe(existing);
    const applied = applyTerminalResult(terminalState, { ...existing, winner: "player" }, 50);
    expect(applied.state).toBe(terminalState);
    expect(applied.events).toEqual([]);
  });

  it.each([
    [{ kind: "draw-failed", losingSide: "player" } as const, "deck-out"],
    [{ kind: "quit", losingSide: "player" } as const, "quit"]
  ])("evaluates %s without using turn limits", (trigger, reason) => {
    const state = sampleState();
    const result = evaluateBattleTerminal(state, trigger, 90);

    expect(result).toMatchObject({ winner: "cpu", loser: "player", reason });
  });

  it("ends the battle with the resigning side as the loser", () => {
    const state = sampleState();

    const result = GameEngine.submitCommand(state, { type: "resign", side: "player" });

    expect(result).toMatchObject({
      ok: true,
      state: {
        phase: "terminal",
        terminalResult: {
          winner: "cpu",
          loser: "player",
          reason: "quit"
        }
      },
      events: [expect.objectContaining({ type: "battle.ended", side: "cpu" })]
    });
  });

  it("stops remaining attackers after a player-base terminal", () => {
    const sampled = sampleState();
    const playerIds = Object.values(sampled.cardInstances)
      .filter((card) => card.ownerSide === "player")
      .slice(0, 2)
      .map((card) => card.instanceId);
    if (!playerIds[0] || !playerIds[1]) {
      throw new Error("Expected two player attackers.");
    }
    let state = placeCreatureForTest(
      { ...sampled, board: createInitialBattleBoard() },
      playerIds[0],
      "player",
      6,
      2
    );
    state = placeCreatureForTest(state, playerIds[1], "player", 5, 2);
    state = {
      ...state,
      bases: updateBattleBase(state.bases, "cpu-base", (base) => ({ ...base, currentHp: 2 })),
      cardInstances: {
        ...state.cardInstances,
        [playerIds[0]]: asAttacker(state.cardInstances[playerIds[0]]!, 3),
        [playerIds[1]]: asAttacker(state.cardInstances[playerIds[1]]!, 3)
      }
    };
    const result = resolveAttackPhase(state, "player", 100);

    expect(result.state.terminalResult?.reason).toBe("base-destroyed");
    expect(
      result.events.filter((event) => event.type === "attack.attacker-started")
    ).toHaveLength(1);
    expect(result.events.some((event) => event.type === "attack.phase-ended")).toBe(false);
  });

  it("keeps all base state unchanged for a deferred spell effect", () => {
    const state = sampleState();
    const spell = Object.values(state.cardInstances)[0];
    if (!spell) {
      throw new Error("Expected a spell fixture card.");
    }
    const result = resolveSimpleSpellEffect(
      state,
      { ...spell, type: "spell" },
      "player",
      120
    );

    expect(result.state).toBe(state);
    expect(result.state.bases).toBe(state.bases);
    expect(result.events.map((event) => event.type)).toEqual([
      "spell.resolved",
      "effect.fizzled"
    ]);
    expect(getBattleBaseById(result.state.bases, "cpu-base").currentHp).toBe(20);
  });
});

function asAttacker(card: BattleCardInstance, attack: number): BattleCardInstance {
  return {
    ...card,
    type: "creature",
    controllerSide: "player",
    currentAttack: attack,
    attack,
    currentHp: 5,
    maxHp: 5,
    health: 5
  };
}

function sampleState(): BattleState {
  return fc.sample(battleStateArbitrary, { numRuns: 1, seed: 8402 })[0];
}

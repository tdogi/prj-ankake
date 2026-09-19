import {
  chooseCpuAction,
  projectCpuVisibleState,
  scoreAction,
  type CpuVisibleCard,
  type CpuVisibleState
} from "@ankake/cpu";
import {
  BATTLE_BASE_IDS,
  coordinateKey,
  createEmptyResonance,
  createInitialBattleBases,
  generateLegalActions,
  getShortestMovementPaths,
  isInitialSummonCoordinate,
  isNormalBoardCoordinate,
  validateBattleCommand
} from "@ankake/domain";
import fc from "fast-check";
import {
  battleStateArbitrary,
  eligibleHandCreatureStateArbitrary,
  movableCreatureStateArbitrary
} from "../generators/battleGenerators";
import { cpuVisibleStateArbitrary } from "../generators/cpuGenerators";

describe("CPU strategy", () => {
  it("prioritizes a movement that wins by destroying the player base", () => {
    const winningMove = {
      command: {
        type: "moveCreature" as const,
        side: "cpu" as const,
        creatureInstanceId: "cpu-attacker",
        origin: { column: 6, row: 7 },
        path: [{ column: 6, row: 8 }]
      },
      label: "Move Vanguard",
      scoreHint: 1
    };
    const summon = {
      command: {
        type: "summonCreature" as const,
        side: "cpu" as const,
        handInstanceId: "large-creature",
        destination: { column: 5, row: 1 }
      },
      label: "Summon Large Creature",
      scoreHint: 8
    };
    const visible = tacticalVisible([summon, winningMove], [
      visibleCard("cpu-attacker", "cpu", 2, 3, { column: 6, row: 7 })
    ], [visibleCard("large-creature", "cpu", 8, 8)]);
    const bases = visible.bases.map((base) =>
      base.id === "player-base" ? { ...base, currentHp: 2 } : base
    );

    const decision = chooseCpuAction({ ...visible, bases });

    expect(decision.kind).toBe("command");
    expect(decision).toMatchObject({ kind: "command", command: winningMove.command });
    if (decision.kind === "command") expect(decision.score.reasons).toContain("win-game");
  });

  it("targets the highest-value enemy when equivalent targeted spells are legal", () => {
    const removeThreat = {
      command: {
        type: "castSpell" as const,
        side: "cpu" as const,
        handInstanceId: "removal",
        targetInstanceId: "dangerous-enemy"
      },
      label: "Cast Removal",
      scoreHint: 2
    };
    const removeSmallEnemy = {
      command: {
        ...removeThreat.command,
        targetInstanceId: "small-enemy"
      },
      label: "Cast Removal",
      scoreHint: 2
    };
    const visible = tacticalVisible([removeSmallEnemy, removeThreat], [
      visibleCard("dangerous-enemy", "player", 7, 7, { column: 6, row: 5 }),
      visibleCard("small-enemy", "player", 1, 1, { column: 5, row: 5 })
    ]);

    const decision = chooseCpuAction(visible);

    expect(decision).toMatchObject({ kind: "command", command: removeThreat.command });
    expect(scoreAction(removeThreat, visible).score).toBeGreaterThan(scoreAction(removeSmallEnemy, visible).score);
  });

  it("recognizes a final neutral-base capture as an immediate win", () => {
    const captureMove = {
      command: {
        type: "moveCreature" as const,
        side: "cpu" as const,
        creatureInstanceId: "cpu-attacker",
        origin: { column: 6, row: 3 },
        path: [{ column: 6, row: 4 }]
      },
      label: "Move Vanguard",
      scoreHint: 1
    };
    const visible = tacticalVisible([captureMove], [
      visibleCard("cpu-attacker", "cpu", 3, 3, { column: 6, row: 3 })
    ]);
    const bases = visible.bases.map((base) => {
      if (base.id === "neutral-left" || base.id === "neutral-right") return { ...base, owner: "cpu" as const };
      if (base.id === "neutral-center") return { ...base, currentHp: 3 };
      return base;
    });

    const decision = chooseCpuAction({ ...visible, bases });

    expect(decision).toMatchObject({ kind: "command", command: captureMove.command });
    if (decision.kind === "command") expect(decision.score.reasons).toContain("win-by-control");
  });

  it("breaks an opening side-base tie toward the left neutral base", () => {
    const advanceSide = {
      command: {
        type: "moveCreature" as const,
        side: "cpu" as const,
        creatureInstanceId: "side-scout",
        origin: { column: 4, row: 2 },
        path: [{ column: 3, row: 3 }]
      },
      label: "Move Side Scout",
      scoreHint: 1
    };
    const advanceElsewhere = {
      command: {
        type: "moveCreature" as const,
        side: "cpu" as const,
        creatureInstanceId: "center-scout",
        origin: { column: 8, row: 2 },
        path: [{ column: 9, row: 3 }]
      },
      label: "Move Side Scout",
      scoreHint: 1
    };
    const visible = tacticalVisible([advanceElsewhere, advanceSide], [
      visibleCard("side-scout", "cpu", 2, 3, { column: 4, row: 2 }),
      visibleCard("center-scout", "cpu", 2, 3, { column: 8, row: 2 })
    ]);

    const decision = chooseCpuAction(visible);

    expect(decision).toMatchObject({ kind: "command", command: advanceSide.command });
    if (decision.kind === "command") expect(decision.score.reasons).toContain("advance-side-objective");
  });

  it("prioritizes attacking the central neutral base over developing another creature", () => {
    const attackCenter = {
      command: {
        type: "moveCreature" as const,
        side: "cpu" as const,
        creatureInstanceId: "center-attacker",
        origin: { column: 5, row: 3 },
        path: [{ column: 5, row: 4 }]
      },
      label: "Move Center Attacker",
      scoreHint: 1
    };
    const developBoard = {
      command: {
        type: "summonCreature" as const,
        side: "cpu" as const,
        handInstanceId: "large-creature",
        destination: { column: 5, row: 1 }
      },
      label: "Summon Large Creature",
      scoreHint: 8
    };
    const visible = tacticalVisible([developBoard, attackCenter], [
      visibleCard("center-attacker", "cpu", 3, 4, { column: 5, row: 3 })
    ], [visibleCard("large-creature", "cpu", 8, 8)]);

    const bases = visible.bases.map((base) =>
      base.id === "neutral-left" ? { ...base, owner: "cpu" as const } : base
    );
    const decision = chooseCpuAction({ ...visible, bases });

    expect(decision).toMatchObject({ kind: "command", command: attackCenter.command });
    if (decision.kind === "command") expect(decision.score.reasons).toContain("pressure-center-base");
  });

  it("prioritizes recapturing a player-owned central neutral base", () => {
    const reclaimCenter = {
      command: {
        type: "moveCreature" as const,
        side: "cpu" as const,
        creatureInstanceId: "center-attacker",
        origin: { column: 5, row: 3 },
        path: [{ column: 5, row: 4 }]
      },
      label: "Move Center Attacker",
      scoreHint: 1
    };
    const contestSide = {
      command: {
        type: "moveCreature" as const,
        side: "cpu" as const,
        creatureInstanceId: "side-attacker",
        origin: { column: 1, row: 3 },
        path: [{ column: 1, row: 4 }]
      },
      label: "Move Side Attacker",
      scoreHint: 1
    };
    const visible = tacticalVisible([contestSide, reclaimCenter], [
      visibleCard("center-attacker", "cpu", 3, 4, { column: 5, row: 3 }),
      visibleCard("side-attacker", "cpu", 3, 4, { column: 1, row: 3 })
    ]);
    const bases = visible.bases.map((base) =>
      base.id === "neutral-center" ? { ...base, owner: "player" as const, currentHp: 3 } : base
    );

    const decision = chooseCpuAction({ ...visible, bases });

    expect(decision).toMatchObject({ kind: "command", command: reclaimCenter.command });
    if (decision.kind === "command") expect(decision.score.reasons).toContain("reclaim-center-base");
  });

  it("defends an immediately threatened owned base before developing the board", () => {
    const removeThreat = {
      command: { type: "castSpell" as const, side: "cpu" as const, handInstanceId: "removal", targetInstanceId: "raider" },
      label: "Cast Removal",
      scoreHint: 2
    };
    const developBoard = {
      command: { type: "summonCreature" as const, side: "cpu" as const, handInstanceId: "brute", destination: { column: 5, row: 1 } },
      label: "Summon Brute",
      scoreHint: 6
    };
    const visible = tacticalVisible(
      [developBoard, removeThreat],
      [visibleCard("raider", "player", 20, 4, { column: 5, row: 2 })],
      [visibleSpell("removal", "AK-055"), visibleCard("brute", "cpu", 7, 7)]
    );

    const decision = chooseCpuAction(visible, (action) =>
      action === removeThreat ? { ...visible, boardCards: [] } : visible
    );

    expect(decision).toMatchObject({ kind: "command", command: removeThreat.command });
    if (decision.kind === "command") {
      expect(decision.score.reasons).toContain("defend-owned-base");
      expect(decision.score.reasons).toContain("prevent-immediate-loss");
    }
  });

  it("uses a draw effect when its hand and board are weak", () => {
    const draw = {
      command: { type: "castSpell" as const, side: "cpu" as const, handInstanceId: "research" },
      label: "Cast Research",
      scoreHint: 3
    };
    const end = { command: { type: "endPlayPhase" as const, side: "cpu" as const, reason: "cpu" as const }, label: "End play phase", scoreHint: 0 };
    const visible = tacticalVisible([end, draw], [], [visibleSpell("research", "AK-017")]);

    const decision = chooseCpuAction(visible, (action) =>
      action === draw ? { ...visible, cpuHandCount: 3 } : visible
    );

    expect(decision).toMatchObject({ kind: "command", command: draw.command });
    if (decision.kind === "command") expect(decision.score.reasons).toContain("refill-weak-hand");
  });

  it("uses resolved board synergy to order a lane buff before a weaker deployment", () => {
    const buff = {
      command: { type: "castSpell" as const, side: "cpu" as const, handInstanceId: "war-cry", effectSelection: { lane: "center" as const } },
      label: "Cast War Cry",
      scoreHint: 2
    };
    const summon = {
      command: { type: "summonCreature" as const, side: "cpu" as const, handInstanceId: "recruit", destination: { column: 5, row: 1 } },
      label: "Summon Recruit",
      scoreHint: 2
    };
    const attacker = visibleCard("attacker", "cpu", 3, 4, { column: 5, row: 4 });
    const visible = tacticalVisible([summon, buff], [attacker], [visibleSpell("war-cry", "AK-008"), visibleCard("recruit", "cpu", 2, 2)]);
    const buffedAttacker = { ...attacker, attack: 5 };

    const decision = chooseCpuAction(visible, (action) =>
      action === buff ? { ...visible, boardCards: [buffedAttacker] } : visible
    );

    expect(decision).toMatchObject({ kind: "command", command: buff.command });
    if (decision.kind === "command") {
      expect(decision.score.reasons).toContain("maximize-board-attack");
      expect(decision.score.reasons).toContain("board-synergy");
    }
  });

  it("returns a stop reason when no legal actions exist", () => {
    const bases = createInitialBattleBases();
    const visible: CpuVisibleState = {
      activeSide: "cpu",
      phase: "play",
      turnNumber: 1,
      cpuHand: [],
      cpuHandCount: 0,
      playerHandCount: 5,
      cpuDeckCount: 35,
      playerDeckCount: 35,
      cpuCurrentPp: 1,
      cpuMaxPp: 1,
      cpuResonance: createEmptyResonance(),
      bases: BATTLE_BASE_IDS.map((id) => bases[id]),
      boardCards: [],
      legalActions: []
    };

    expect(chooseCpuAction(visible)).toEqual({
      kind: "stop",
      reason: "no-legal-action"
    });
  });

  it("chooses deterministic commands or explicit stop reasons", () => {
    fc.assert(
      fc.property(cpuVisibleStateArbitrary, (visible) => {
        const first = chooseCpuAction(visible);
        const second = chooseCpuAction(visible);

        expect(first).toEqual(second);
        if (first.kind === "command") {
          expect(visible.legalActions.some((action) => action.command === first.command)).toBe(true);
        } else {
          expect(["no-legal-action", "no-beneficial-action", "terminal"]).toContain(first.reason);
        }
      }),
      { numRuns: 40 }
    );
  });

  it("receives only canonical normal summon and movement destinations", () => {
    fc.assert(
      fc.property(battleStateArbitrary, (state) => {
        const cpuState = {
          ...state,
          phase: "play" as const,
          activeSide: "cpu" as const,
          terminalResult: undefined
        };
        const legalActions = generateLegalActions(cpuState, "cpu");
        const visible = projectCpuVisibleState(cpuState, legalActions);

        for (const action of visible.legalActions) {
          if (action.command.type === "summonCreature") {
            expect(isNormalBoardCoordinate(action.command.destination)).toBe(true);
            expect(isInitialSummonCoordinate("cpu", action.command.destination)).toBe(true);
          }

          if (action.command.type === "moveCreature") {
            expect(action.command.path.every(isNormalBoardCoordinate)).toBe(true);
          }
        }

        const decision = chooseCpuAction(visible);
        if (decision.kind === "command" && decision.command.type === "summonCreature") {
          expect(isNormalBoardCoordinate(decision.command.destination)).toBe(true);
          expect(isInitialSummonCoordinate("cpu", decision.command.destination)).toBe(true);
        }
        if (decision.kind === "command" && decision.command.type === "moveCreature") {
          expect(decision.command.path.every(isNormalBoardCoordinate)).toBe(true);
        }
      }),
      { numRuns: 40 }
    );
  });

  it("chooses a deterministic summon only from CPU row 1 columns 3, 4, 5, 7, 8, and 9", () => {
    fc.assert(
      fc.property(
        eligibleHandCreatureStateArbitrary.filter((fixture) => fixture.side === "cpu"),
        (fixture) => {
          const legalActions = generateLegalActions(fixture.state, "cpu");
          const visible = projectCpuVisibleState(fixture.state, legalActions);
          const summons = legalActions.filter(
            (action) => action.command.type === "summonCreature"
          );
          const first = chooseCpuAction(visible);
          const second = chooseCpuAction(visible);

          // A summon-triggered targeted effect is legal only when a complete
          // target selection exists.  Otherwise the CPU must not issue an
          // incomplete summon command.
          expect([0, 6]).toContain(summons.length);
          expect(first).toEqual(second);
          if (summons.length === 0) {
            expect(first.kind).toBe("stop");
            return;
          }
          expect(first.kind).toBe("command");
          if (first.kind !== "command" || first.command.type !== "summonCreature") {
            return;
          }

          expect(first.command.destination.row).toBe(1);
          expect([3, 4, 5, 7, 8, 9]).toContain(first.command.destination.column);
          expect(isInitialSummonCoordinate("cpu", first.command.destination)).toBe(true);
        }
      ),
      { numRuns: 40 }
    );
  });

  it("receives one deterministic shortest move per reachable non-origin endpoint", () => {
    fc.assert(
      fc.property(
        movableCreatureStateArbitrary.filter((fixture) => fixture.side === "cpu"),
        (fixture) => {
          const actions = generateLegalActions(fixture.state, "cpu");
          const movementActions = actions.filter(
            (action) => action.command.type === "moveCreature"
          );
          const expectedPaths = getShortestMovementPaths(
            fixture.state,
            "cpu",
            fixture.creatureInstanceId
          );
          const endpointKeys = movementActions.map((action) => {
            if (action.command.type !== "moveCreature") {
              throw new Error("Expected a movement action.");
            }
            return coordinateKey(action.command.path[action.command.path.length - 1]!);
          });

          expect(
            movementActions.map((action) => {
              if (action.command.type !== "moveCreature") {
                throw new Error("Expected a movement action.");
              }
              return action.command.path;
            })
          ).toEqual(expectedPaths);
          expect(new Set(endpointKeys).size).toBe(endpointKeys.length);
          expect(endpointKeys).not.toContain(coordinateKey(fixture.origin));
          for (const action of movementActions) {
            if (action.command.type !== "moveCreature") {
              continue;
            }
            expect(action.command.origin).toEqual(fixture.origin);
            expect(validateBattleCommand(fixture.state, action.command)).toEqual([]);
          }

          const visible = projectCpuVisibleState(fixture.state, actions);
          expect(chooseCpuAction(visible)).toEqual(chooseCpuAction(visible));
        }
      ),
      { numRuns: 60, seed: 7311 }
    );
  });
});

function tacticalVisible(
  legalActions: CpuVisibleState["legalActions"],
  boardCards: readonly CpuVisibleCard[] = [],
  cpuHand: readonly CpuVisibleCard[] = []
): CpuVisibleState {
  const bases = createInitialBattleBases();
  return {
    activeSide: "cpu",
    phase: "play",
    turnNumber: 4,
    cpuHand,
    cpuHandCount: cpuHand.length,
    playerHandCount: 3,
    cpuDeckCount: 20,
    playerDeckCount: 20,
    cpuCurrentPp: 5,
    cpuMaxPp: 5,
    cpuResonance: createEmptyResonance(),
    bases: BATTLE_BASE_IDS.map((id) => bases[id]),
    boardCards,
    legalActions
  };
}

function visibleCard(
  instanceId: string,
  side: "cpu" | "player",
  attack: number,
  hp: number,
  position?: { readonly column: number; readonly row: number }
): CpuVisibleCard {
  return {
    instanceId,
    catalogCardId: instanceId,
    name: instanceId,
    type: "creature",
    side,
    attribute: "fire",
    currentCost: 1,
    attack,
    hp,
    maxHp: hp,
    movement: 1,
    isToken: false,
    effectIds: [],
    position
  };
}

function visibleSpell(instanceId: string, catalogCardId: string): CpuVisibleCard {
  return {
    instanceId,
    catalogCardId,
    name: instanceId,
    type: "spell",
    side: "cpu",
    attribute: "water",
    currentCost: 3,
    movement: 0,
    isToken: false,
    effectIds: [catalogCardId]
  };
}

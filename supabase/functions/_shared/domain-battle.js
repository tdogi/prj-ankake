// packages/domain/src/battle/constants.ts
var BATTLE_BOARD_COLUMNS = 11;
var BATTLE_BOARD_ROWS = 9;
var BATTLE_HAND_LIMIT = 9;
var BATTLE_STARTING_HAND_SIZE = 5;
var BATTLE_STARTING_PP = 1;
var BATTLE_MAX_PP = 15;
var BATTLE_BASE_MOVEMENT = 1;
var BATTLE_LOG_LIMIT = 500;
var CPU_ACCEPTED_COMMAND_LIMIT = 30;
var HUMAN_PLAY_PHASE_SECONDS = 90;
var RESONANCE_MAX = 15;
var RESONANCE_ACTIVE_THRESHOLD = 15;

// packages/domain/src/battle/bases.ts
var BATTLE_BASE_IDS = Object.freeze([
  "cpu-base",
  "neutral-left",
  "neutral-center",
  "neutral-right",
  "player-base"
]);
var BATTLE_BASE_DEFINITIONS = Object.freeze({
  "cpu-base": createDefinition(
    "cpu-base",
    "CPU Base",
    6,
    1,
    "player-base",
    "cpu",
    20
  ),
  "neutral-left": createDefinition(
    "neutral-left",
    "Left Neutral Base",
    2,
    5,
    "neutral-base",
    "none",
    10
  ),
  "neutral-center": createDefinition(
    "neutral-center",
    "Center Neutral Base",
    6,
    5,
    "neutral-base",
    "none",
    20
  ),
  "neutral-right": createDefinition(
    "neutral-right",
    "Right Neutral Base",
    10,
    5,
    "neutral-base",
    "none",
    10
  ),
  "player-base": createDefinition(
    "player-base",
    "Player Base",
    6,
    9,
    "player-base",
    "player",
    20
  )
});
function createInitialBattleBases() {
  return Object.fromEntries(
    BATTLE_BASE_IDS.map((id) => {
      const definition = BATTLE_BASE_DEFINITIONS[id];
      return [
        id,
        {
          id,
          coordinate: { ...definition.coordinate },
          kind: definition.kind,
          owner: definition.initialOwner,
          currentHp: definition.maxHp,
          maxHp: definition.maxHp
        }
      ];
    })
  );
}
function getBattleBaseById(bases, baseId) {
  return bases[baseId];
}
function getBattleBaseAt(bases, coordinate) {
  return BATTLE_BASE_IDS.map((id) => bases[id]).find(
    (base) => base.coordinate.column === coordinate.column && base.coordinate.row === coordinate.row
  );
}
function getOwnedNeutralBases(bases, side) {
  return BATTLE_BASE_IDS.map((id) => bases[id]).filter(
    (base) => base.kind === "neutral-base" && base.owner === side
  );
}
function getPlayerBaseId(side) {
  return side === "player" ? "player-base" : "cpu-base";
}
function getBattleBaseLabel(baseId) {
  return BATTLE_BASE_DEFINITIONS[baseId].label;
}
function updateBattleBase(bases, baseId, update) {
  const nextBase = update(bases[baseId]);
  return {
    ...bases,
    [baseId]: { ...nextBase, id: baseId }
  };
}
function createDefinition(id, label, column, row, kind, initialOwner, maxHp) {
  return Object.freeze({
    id,
    label,
    coordinate: Object.freeze({ column, row }),
    kind,
    initialOwner,
    maxHp
  });
}

// packages/domain/src/battle/board.ts
var EXISTING_BOARD_COLUMNS_BY_ROW = Object.freeze({
  1: Object.freeze([3, 4, 5, 6, 7, 8, 9]),
  2: Object.freeze([2, 3, 5, 6, 7, 9, 10]),
  3: Object.freeze([1, 2, 5, 6, 7, 10, 11]),
  4: Object.freeze([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]),
  5: Object.freeze([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]),
  6: Object.freeze([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]),
  7: Object.freeze([1, 2, 5, 6, 7, 10, 11]),
  8: Object.freeze([2, 3, 5, 6, 7, 9, 10]),
  9: Object.freeze([3, 4, 5, 6, 7, 8, 9])
});
var BASE_TERRAIN_BY_COORDINATE = Object.freeze({
  "6:1": "cpu-base",
  "2:5": "neutral-base",
  "6:5": "neutral-base",
  "10:5": "neutral-base",
  "6:9": "player-base"
});
var CANONICAL_BOARD_COORDINATES = Object.freeze(
  Array.from({ length: BATTLE_BOARD_ROWS }, (_, index) => index + 1).flatMap(
    (row) => (EXISTING_BOARD_COLUMNS_BY_ROW[row] ?? []).map(
      (column) => Object.freeze({ column, row })
    )
  )
);
var EXISTING_BOARD_COORDINATE_KEYS = new Set(
  CANONICAL_BOARD_COORDINATES.map(coordinateKey)
);
var INITIAL_SUMMON_COORDINATES_BY_SIDE = Object.freeze({
  cpu: createInitialSummonCoordinates(1),
  player: createInitialSummonCoordinates(9)
});
var INITIAL_SUMMON_COORDINATE_KEYS_BY_SIDE = Object.freeze({
  cpu: new Set(INITIAL_SUMMON_COORDINATES_BY_SIDE.cpu.map(coordinateKey)),
  player: new Set(INITIAL_SUMMON_COORDINATES_BY_SIDE.player.map(coordinateKey))
});
function coordinateKey(coordinate) {
  return `${coordinate.column}:${coordinate.row}`;
}
function sameCoordinate(left, right) {
  return left.column === right.column && left.row === right.row;
}
function isInsideBoard(coordinate) {
  return Number.isInteger(coordinate.column) && Number.isInteger(coordinate.row) && coordinate.column >= 1 && coordinate.column <= BATTLE_BOARD_COLUMNS && coordinate.row >= 1 && coordinate.row <= BATTLE_BOARD_ROWS;
}
function isExistingBoardCoordinate(coordinate) {
  return isInsideBoard(coordinate) && EXISTING_BOARD_COORDINATE_KEYS.has(coordinateKey(coordinate));
}
function getLane(column) {
  if (column <= 4) {
    return "left";
  }
  if (column >= 8) {
    return "right";
  }
  return "center";
}
function getTerrain(coordinate) {
  if (!isExistingBoardCoordinate(coordinate)) {
    return void 0;
  }
  return BASE_TERRAIN_BY_COORDINATE[coordinateKey(coordinate)] ?? "normal";
}
function isNormalBoardCoordinate(coordinate) {
  return getTerrain(coordinate) === "normal";
}
function createInitialBattleBoard() {
  return {
    squares: CANONICAL_BOARD_COORDINATES.map((coordinate) => ({
      coordinate,
      lane: getLane(coordinate.column),
      terrain: getTerrain(coordinate)
    }))
  };
}
function getBoardSquare(board, coordinate) {
  return board.squares.find((square) => sameCoordinate(square.coordinate, coordinate));
}
function getOccupantId(board, coordinate) {
  return getBoardSquare(board, coordinate)?.occupantId;
}
function setBoardOccupant(board, coordinate, occupantId) {
  return {
    squares: board.squares.map(
      (square) => sameCoordinate(square.coordinate, coordinate) ? {
        ...square,
        occupantId
      } : square
    )
  };
}
function isAdjacentStep(from, to) {
  const columnDelta = Math.abs(from.column - to.column);
  const rowDelta = Math.abs(from.row - to.row);
  return columnDelta <= 1 && rowDelta <= 1 && columnDelta + rowDelta > 0;
}
function getAdjacentBoardCoordinates(coordinate) {
  return CANONICAL_BOARD_COORDINATES.filter(
    (candidate) => isAdjacentStep(coordinate, candidate)
  );
}
function isInitialSummonCoordinate(side, coordinate) {
  return INITIAL_SUMMON_COORDINATE_KEYS_BY_SIDE[side].has(coordinateKey(coordinate));
}
function createInitialSummonCoordinates(row) {
  return Object.freeze(
    [3, 4, 5, 7, 8, 9].map((column) => Object.freeze({ column, row }))
  );
}

// packages/domain/src/battle/rng.ts
function createBattleRng(seedInput) {
  return createRngFromState({
    seed: normalizeSeed(seedInput),
    position: 0
  });
}
function createRngFromState(state) {
  return {
    state,
    next: () => {
      const nextPosition = state.position + 1;
      const value = randomUnit(state.seed, nextPosition);
      return [
        value,
        createRngFromState({
          seed: state.seed,
          position: nextPosition
        })
      ];
    },
    nextInt: (maxExclusive) => {
      if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
        return [0, createRngFromState(state)];
      }
      const [unit, nextRng] = createRngFromState(state).next();
      return [Math.floor(unit * maxExclusive), nextRng];
    }
  };
}
function shuffleWithRng(values, rng) {
  const next = [...values];
  let current = rng;
  for (let index = next.length - 1; index > 0; index -= 1) {
    const [swapIndex, nextRng] = current.nextInt(index + 1);
    current = nextRng;
    const value = next[index];
    next[index] = next[swapIndex];
    next[swapIndex] = value;
  }
  return [next, current];
}
function normalizeSeed(input) {
  if (typeof input === "number" && Number.isFinite(input)) {
    return input >>> 0;
  }
  const text = String(input);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
function randomUnit(seed, position) {
  let value = seed + Math.imul(position, 2654435769) >>> 0;
  value = Math.imul(value ^ value >>> 15, value | 1);
  value ^= value + Math.imul(value ^ value >>> 7, value | 61);
  return ((value ^ value >>> 14) >>> 0) / 4294967296;
}

// packages/domain/src/battle/log.ts
function eventToLogEntry(event2, state) {
  const sourceCard = sourceCardForEvent(event2, state);
  return {
    sequence: event2.sequence,
    message: event2.message,
    type: event2.type,
    side: event2.side,
    ...sourceCard ? { sourceCard } : {}
  };
}
function appendBattleLogEntries(log, events, terminalSummary, state) {
  const entries = [...log.entries, ...events.map((event2) => eventToLogEntry(event2, state))];
  return {
    entries: entries.slice(Math.max(0, entries.length - BATTLE_LOG_LIMIT)),
    terminalSummary: terminalSummary ?? log.terminalSummary
  };
}
function sourceCardForEvent(event2, state) {
  const sourceInstanceId = event2.data?.effectSourceInstanceId;
  if (typeof sourceInstanceId !== "string") return void 0;
  const card = state?.cardInstances[sourceInstanceId];
  return card ? snapshotCard(card) : void 0;
}
function snapshotCard(card) {
  return {
    instanceId: card.instanceId,
    catalogCardId: card.catalogCardId,
    name: card.name,
    type: card.type,
    attribute: card.attribute,
    controllerSide: card.controllerSide,
    currentAttack: card.currentAttack ?? card.attack,
    currentHp: card.currentHp,
    maxHp: card.maxHp,
    movement: card.movement,
    effectText: card.effectText
  };
}
function createEmptyBattleLog() {
  return {
    entries: []
  };
}

// packages/domain/src/catalog/types.ts
var CARD_ATTRIBUTES = ["fire", "water", "wind", "light", "dark"];

// packages/domain/src/battle/resonance.ts
var BATTLE_LANES = ["left", "center", "right"];
function createEmptyResonanceUsage() {
  const unused = () => Object.fromEntries(BATTLE_LANES.map((lane) => [lane, false]));
  return { water: unused(), wind: unused(), dark: unused() };
}
function createEmptyResonance() {
  return Object.fromEntries(
    BATTLE_LANES.map((lane) => [
      lane,
      Object.fromEntries(CARD_ATTRIBUTES.map((attribute) => [attribute, 0]))
    ])
  );
}
function increaseResonance(resonance, lane, attribute, amount) {
  const current = resonance[lane][attribute];
  return {
    ...resonance,
    [lane]: {
      ...resonance[lane],
      [attribute]: clampResonance(current + Math.max(0, amount))
    }
  };
}
function clampResonance(value) {
  return Math.min(RESONANCE_MAX, Math.max(0, Math.trunc(value)));
}
function resonanceGain(originalCost) {
  return Math.max(0, Math.trunc(originalCost));
}
function isResonanceActive(resonance, lane, attribute) {
  return resonance[lane][attribute] >= RESONANCE_ACTIVE_THRESHOLD;
}
function getCreaturePlayCost(state, side, card, lane) {
  const activeWindLanes = BATTLE_LANES.filter(
    (candidate) => isResonanceActive(state.players[side].resonance, candidate, "wind")
  ).length;
  const handCost = getEffectiveCreatureHandCost(state, card);
  const intrinsicCost = card.catalogCardId === "AK-028" ? activeWindLanes > 0 ? 1 : handCost : card.catalogCardId === "AK-036" ? Math.max(0, handCost - activeWindLanes * 3) : handCost;
  return isWindResonanceDiscountAvailable(state, side, lane) ? Math.max(1, intrinsicCost - 1) : Math.max(0, intrinsicCost);
}
function getEffectiveCreatureHandCost(state, card) {
  const auraCount = Object.values(state.cardInstances).filter(
    (source) => source.catalogCardId === "AK-033" && source.zone === "board" && source.controllerSide === card.controllerSide && !source.effectsDisabled
  ).length;
  return Math.max(0, card.currentCost - auraCount);
}
function isWindResonanceDiscountAvailable(state, side, lane) {
  return isResonanceActive(state.players[side].resonance, lane, "wind") && !state.players[side].resonanceUsage.wind[lane];
}
function getEffectiveCreatureAttack(state, card) {
  const baseAttack = Math.max(0, card.currentAttack ?? card.attack ?? 0);
  if (card.type !== "creature" && card.type !== "creature-token" || card.zone !== "board" || !card.position) {
    return baseAttack;
  }
  const lane = getLane(card.position.column);
  const fireBonus = isResonanceActive(state.players[card.controllerSide].resonance, lane, "fire") ? 1 : 0;
  const berserkerBonus = card.catalogCardId === "AK-004" && !card.effectsDisabled && fireBonus > 0 ? 2 : 0;
  const captainBonus = laneAuraSources(state, card, "AK-009").length;
  const championBonus = card.catalogCardId === "AK-046" && !card.effectsDisabled ? friendlyTokenCount(state, card.controllerSide) : 0;
  const tokenBonus = card.isToken ? laneAuraSources(state, card, "AK-043").length : 0;
  return baseAttack + fireBonus + berserkerBonus + captainBonus + championBonus + tokenBonus;
}
function getEffectiveCreatureMovement(state, card) {
  const baseMovement = card.movementOverride ?? card.movement + (card.temporaryMovementBonus ?? 0);
  const intrinsicMovement = card.catalogCardId === "AK-013" || card.catalogCardId === "AK-022" ? Math.max(2, baseMovement) : baseMovement;
  if (card.zone !== "board" || !card.position) return Math.max(0, intrinsicMovement);
  return Math.max(0, intrinsicMovement + laneAuraSources(state, card, "AK-021").length);
}
function getEffectiveCreatureMaxHp(state, card) {
  const baseHp = card.maxHp ?? card.currentHp ?? 0;
  if (card.catalogCardId === "AK-046" && card.zone === "board" && !card.effectsDisabled) return baseHp + friendlyTokenCount(state, card.controllerSide);
  if (!card.isToken || card.zone !== "board" || !card.position) return baseHp;
  return baseHp + laneAuraSources(state, card, "AK-043").length * 2;
}
function getEffectiveCreatureCurrentHp(state, card) {
  const baseHp = card.currentHp ?? 0;
  if (card.catalogCardId === "AK-046" && card.zone === "board" && !card.effectsDisabled) return baseHp + friendlyTokenCount(state, card.controllerSide);
  if (!card.isToken || card.zone !== "board" || !card.position) return baseHp;
  return baseHp + laneAuraSources(state, card, "AK-043").length * 2;
}
function friendlyTokenCount(state, side) {
  return Object.values(state.cardInstances).filter((card) => card.zone === "board" && card.controllerSide === side && card.isToken).length;
}
function laneAuraSources(state, target, sourceCardId) {
  if (!target.position) return [];
  const lane = getLane(target.position.column);
  return Object.values(state.cardInstances).filter(
    (source) => source.catalogCardId === sourceCardId && source.instanceId !== target.instanceId && source.zone === "board" && source.controllerSide === target.controllerSide && source.position !== void 0 && !source.effectsDisabled && getLane(source.position.column) === lane
  );
}

// packages/domain/src/deck/types.ts
var DECK_BATTLE_READY_CARD_COUNT = 40;

// packages/domain/src/deck/operations.ts
function sortDeckCards(cards) {
  return [...cards].filter((entry) => entry.count > 0).sort((left, right) => left.cardId.localeCompare(right.cardId, "en"));
}
function normalizeDeckCards(cards) {
  const counts = /* @__PURE__ */ new Map();
  for (const entry of cards) {
    const current = counts.get(entry.cardId) ?? 0;
    counts.set(entry.cardId, current + entry.count);
  }
  return sortDeckCards(
    [...counts.entries()].map(([cardId, count]) => ({
      cardId,
      count
    }))
  );
}
function getDeckTotalCount(cards) {
  return cards.reduce((total, entry) => total + entry.count, 0);
}

// packages/domain/src/battle/stateFactory.ts
function createBattleState(input) {
  const issues = validateSetupDeck(input.playerDeck, "player", input.catalog).concat(
    validateSetupDeck(input.cpuDeck, "cpu", input.catalog)
  );
  if (issues.length > 0) {
    return {
      ok: false,
      issues
    };
  }
  const seed = input.seed ?? `${input.now}:${input.playerDeck.deckId}:${input.cpuDeck.deckId}`;
  let rng = createBattleRng(seed);
  const [firstPlayer, firstPlayerRng] = decideFirstPlayer(input.firstPlayerMode, rng);
  rng = firstPlayerRng;
  const playerSnapshot = createBattleDeckSnapshot(input.playerDeck, input.now);
  const cpuSnapshot = createBattleDeckSnapshot(input.cpuDeck, input.now);
  const [playerInstances, playerDeckOrder, afterPlayerShuffle] = createShuffledInstances(
    playerSnapshot,
    "player",
    input.catalog,
    rng
  );
  const [cpuInstances, cpuDeckOrder, afterCpuShuffle] = createShuffledInstances(
    cpuSnapshot,
    "cpu",
    input.catalog,
    afterPlayerShuffle
  );
  rng = afterCpuShuffle;
  const cardInstances = {
    ...playerInstances,
    ...cpuInstances
  };
  const [playerState, playerDrawEvents] = createInitialPlayerState(
    "player",
    playerSnapshot,
    playerDeckOrder,
    cardInstances,
    2
  );
  const [cpuState, cpuDrawEvents] = createInitialPlayerState(
    "cpu",
    cpuSnapshot,
    cpuDeckOrder,
    cardInstances,
    2 + playerDrawEvents.length
  );
  const battleId = `battle-${seed}`;
  const startedEvent = {
    sequence: 1,
    type: "battle.started",
    message: "Battle started."
  };
  const firstPlayerEvent = {
    sequence: 2 + playerDrawEvents.length + cpuDrawEvents.length,
    type: "first-player.decided",
    side: firstPlayer,
    message: `${labelSide(firstPlayer)} takes the first turn.`
  };
  return {
    ok: true,
    state: {
      battleId,
      phase: "play",
      activeSide: firstPlayer,
      board: createInitialBattleBoard(),
      bases: createInitialBattleBases(),
      players: {
        player: playerState,
        cpu: cpuState
      },
      cardInstances,
      metadata: {
        battleId,
        setup: {
          playerDeckId: input.playerDeck.deckId,
          cpuDeckId: input.cpuDeck.deckId,
          firstPlayerMode: input.firstPlayerMode,
          seed
        },
        startedAt: input.now,
        firstPlayer,
        turnNumber: 1,
        elapsedSeconds: 0,
        rng: rng.state
      },
      eventCursor: firstPlayerEvent.sequence,
      terminalResult: void 0
    },
    events: [startedEvent, ...playerDrawEvents, ...cpuDrawEvents, firstPlayerEvent]
  };
}
function placeCreatureForTest(state, instanceId, side, column, row) {
  const card = state.cardInstances[instanceId];
  if (!card) {
    return state;
  }
  const coordinate = { column, row };
  const player = state.players[side];
  const boardEntrySequence = Math.max(
    state.eventCursor,
    ...Object.values(state.cardInstances).filter((instance) => instance.zone === "board").map((instance) => instance.boardEntrySequence ?? 0)
  ) + 1;
  return {
    ...state,
    board: setBoardOccupant(state.board, coordinate, instanceId),
    players: {
      ...state.players,
      [side]: {
        ...player,
        handZone: player.handZone.filter((id) => id !== instanceId)
      }
    },
    cardInstances: {
      ...state.cardInstances,
      [instanceId]: {
        ...card,
        zone: "board",
        position: coordinate,
        boardEntrySequence
      }
    },
    eventCursor: boardEntrySequence
  };
}
function validateSetupDeck(deck, side, catalog) {
  const issues = [];
  const normalizedCards = normalizeDeckCards(deck.cards);
  if (getDeckTotalCount(normalizedCards) !== DECK_BATTLE_READY_CARD_COUNT) {
    issues.push({
      code: side === "player" ? "battle-setup.player-deck-invalid" : "battle-setup.cpu-deck-invalid",
      message: `${labelSide(side)} deck must contain ${DECK_BATTLE_READY_CARD_COUNT} cards.`,
      deckId: deck.deckId
    });
  }
  for (const entry of normalizedCards) {
    if (!catalog.cardsById.has(entry.cardId)) {
      issues.push({
        code: "battle-setup.card-missing",
        message: `Deck contains an unknown card: ${entry.cardId}.`,
        deckId: deck.deckId,
        cardId: entry.cardId
      });
    }
  }
  return issues;
}
function createBattleDeckSnapshot(deck, now) {
  return {
    sourceDeckId: deck.deckId,
    sourceDeckName: deck.name,
    cards: normalizeDeckCards(deck.cards).flatMap(
      (entry) => Array.from({ length: entry.count }, () => entry.cardId)
    ),
    capturedAt: now
  };
}
function decideFirstPlayer(mode, rng) {
  if (mode === "player-first") {
    return ["player", rng];
  }
  if (mode === "player-second") {
    return ["cpu", rng];
  }
  const [index, nextRng] = rng.nextInt(2);
  return [index === 0 ? "player" : "cpu", nextRng];
}
function createShuffledInstances(snapshot, side, catalog, rng) {
  const instances = {};
  const ids = snapshot.cards.map((cardId, index) => {
    const card = catalog.cardsById.get(cardId);
    const instanceId = `${side}-${index + 1}-${cardId}`;
    instances[instanceId] = createCardInstance(instanceId, card, side);
    return instanceId;
  });
  const [shuffledIds, nextRng] = shuffleWithRng(ids, rng);
  return [instances, shuffledIds, nextRng];
}
function createInitialPlayerState(side, snapshot, deckOrder, cardInstances, firstSequence) {
  const handZone = deckOrder.slice(0, BATTLE_STARTING_HAND_SIZE);
  const deckZone = deckOrder.slice(BATTLE_STARTING_HAND_SIZE);
  const events = handZone.map((instanceId, index) => {
    cardInstances[instanceId] = {
      ...cardInstances[instanceId],
      zone: "hand"
    };
    return {
      sequence: firstSequence + index,
      type: "card.drawn",
      side,
      instanceId,
      message: `${labelSide(side)} drew a card.`
    };
  });
  return [
    {
      side,
      deckSnapshot: snapshot,
      deckZone,
      handZone,
      graveyardZone: [],
      currentPp: BATTLE_STARTING_PP,
      maxPp: BATTLE_STARTING_PP,
      resonance: createEmptyResonance(),
      resonanceUsage: createEmptyResonanceUsage(),
      turnsStarted: side === "player" ? 1 : 0
    },
    events
  ];
}
function createCardInstance(instanceId, card, side) {
  return {
    instanceId,
    catalogCardId: card.id,
    ownerSide: side,
    controllerSide: side,
    zone: "deck",
    name: card.name,
    type: card.type,
    attribute: card.attribute,
    cost: card.cost,
    currentCost: card.cost,
    attack: card.type === "creature" ? card.attack : void 0,
    currentAttack: card.type === "creature" ? card.attack : void 0,
    health: card.type === "creature" ? card.health : void 0,
    currentHp: card.type === "creature" ? card.health : void 0,
    maxHp: card.type === "creature" ? card.health : void 0,
    movement: card.type === "creature" ? BATTLE_BASE_MOVEMENT : 0,
    isToken: false,
    effectText: card.effectText,
    effectIds: card.effectIds,
    summonedThisTurn: false,
    movedThisTurn: false
  };
}
function labelSide(side) {
  return side === "player" ? "Player" : "CPU";
}

// packages/domain/src/battle/movement.ts
function queryMovementStart(state, side, creatureInstanceId) {
  const sourceIssues = validateMovementSource(state, side, creatureInstanceId);
  if (sourceIssues.length > 0) {
    return ineligible(creatureInstanceId, sourceIssues);
  }
  const card = state.cardInstances[creatureInstanceId];
  const origin = card.position;
  const candidateNextSteps = getMovementCandidates(
    state,
    creatureInstanceId,
    origin,
    origin
  );
  if (candidateNextSteps.length === 0) {
    return ineligible(creatureInstanceId, [
      {
        code: "battle.move.no-destination",
        message: "No legal adjacent square is available for this creature.",
        path: "path"
      }
    ]);
  }
  return {
    eligible: true,
    creatureInstanceId,
    origin,
    maximumMovement: effectiveMovement(state, card),
    candidateNextSteps,
    issues: []
  };
}
function evaluateMovementDraft(state, side, creatureInstanceId, expectedOrigin, proposedPath) {
  const card = state.cardInstances[creatureInstanceId];
  const maximumMovement = card ? effectiveMovement(state, card) : 0;
  const sourceIssues = validateMovementSource(
    state,
    side,
    creatureInstanceId,
    expectedOrigin
  );
  if (sourceIssues.length > 0) {
    return {
      sourceEligible: false,
      creatureInstanceId,
      expectedOrigin,
      validPath: [],
      provisionalPosition: expectedOrigin,
      usedMovement: 0,
      maximumMovement,
      candidateNextSteps: [],
      issues: sourceIssues
    };
  }
  const validPath = [];
  let provisionalPosition = expectedOrigin;
  let firstIssue;
  for (const [index, step] of proposedPath.entries()) {
    if (index >= maximumMovement) {
      firstIssue = {
        code: "battle.move.too-far",
        message: "The movement path is longer than this creature's movement.",
        path: `path.${index}`
      };
      break;
    }
    const stepIssue = validateMovementStep(
      state,
      creatureInstanceId,
      expectedOrigin,
      provisionalPosition,
      step,
      index
    );
    if (stepIssue) {
      firstIssue = stepIssue;
      break;
    }
    validPath.push(step);
    provisionalPosition = step;
  }
  const candidateNextSteps = validPath.length < maximumMovement ? getMovementCandidates(
    state,
    creatureInstanceId,
    expectedOrigin,
    provisionalPosition
  ) : [];
  return {
    sourceEligible: true,
    creatureInstanceId,
    expectedOrigin,
    validPath,
    provisionalPosition,
    usedMovement: validPath.length,
    maximumMovement,
    candidateNextSteps,
    issues: firstIssue ? [firstIssue] : []
  };
}
function effectiveMovement(state, card) {
  const lane = card.position ? getLane(card.position.column) : void 0;
  const receivesWaterResonance = lane !== void 0 && state.phase === "play" && state.activeSide === card.controllerSide && isResonanceActive(state.players[card.controllerSide].resonance, lane, "water") && !state.players[card.controllerSide].resonanceUsage.water[lane];
  return getEffectiveCreatureMovement(state, card) + (receivesWaterResonance ? 1 : 0);
}
function getNextMovementSteps(state, side, creatureInstanceId, expectedOrigin, path) {
  return evaluateMovementDraft(
    state,
    side,
    creatureInstanceId,
    expectedOrigin,
    path
  ).candidateNextSteps;
}
function validateMovementPath(state, side, creatureInstanceId, expectedOrigin, path) {
  const evaluation = evaluateMovementDraft(
    state,
    side,
    creatureInstanceId,
    expectedOrigin,
    path
  );
  if (!evaluation.sourceEligible || evaluation.issues.length > 0) {
    return evaluation.issues;
  }
  if (path.length === 0) {
    return [
      {
        code: "battle.move.path-invalid",
        message: "Movement requires at least one path step.",
        path: "path"
      }
    ];
  }
  return evaluation.validPath.length === path.length ? [] : [
    {
      code: "battle.move.path-invalid",
      message: "The movement path is not currently legal.",
      path: `path.${evaluation.validPath.length}`
    }
  ];
}
function validateMovementSource(state, side, creatureInstanceId, expectedOrigin) {
  if (state.phase === "terminal" || state.terminalResult) {
    return [
      {
        code: "battle.terminal",
        message: "The battle has already ended."
      }
    ];
  }
  if (state.phase !== "play") {
    return [
      {
        code: "battle.phase.invalid",
        message: "Battle commands can be confirmed only during a play phase."
      }
    ];
  }
  if (state.activeSide !== side) {
    return [
      {
        code: "battle.side.inactive",
        message: "It is not this side's turn."
      }
    ];
  }
  const card = state.cardInstances[creatureInstanceId];
  if (!card) {
    return [
      {
        code: "battle.card.not-found",
        message: "The selected creature no longer exists.",
        path: "creatureInstanceId"
      }
    ];
  }
  if (card.type !== "creature" && card.type !== "creature-token" || card.zone !== "board" || !card.position) {
    return [
      {
        code: "battle.card.zone-invalid",
        message: "Only creatures on the board can move.",
        path: "creatureInstanceId"
      }
    ];
  }
  if (card.controllerSide !== side) {
    return [
      {
        code: "battle.card.owner-invalid",
        message: "Only your own creatures can move.",
        path: "creatureInstanceId"
      }
    ];
  }
  if (expectedOrigin && !sameCoordinate(card.position, expectedOrigin)) {
    return [
      {
        code: "battle.move.origin-changed",
        message: "The selected creature is no longer at the expected origin.",
        path: "origin"
      }
    ];
  }
  if (card.summonedThisTurn || card.movedThisTurn) {
    return [
      {
        code: "battle.move.already-moved",
        message: card.summonedThisTurn ? "A creature cannot move on the turn it was summoned." : "This creature cannot move again this turn.",
        path: "creatureInstanceId"
      }
    ];
  }
  if (effectiveMovement(state, card) < 1) {
    return [
      {
        code: "battle.move.too-far",
        message: "This creature has no movement available.",
        path: "movement"
      }
    ];
  }
  return [];
}
function getShortestMovementPaths(state, side, creatureInstanceId) {
  const start = queryMovementStart(state, side, creatureInstanceId);
  if (!start.eligible) {
    return [];
  }
  const visited = /* @__PURE__ */ new Set([coordinateKey(start.origin)]);
  const paths = [];
  const queue = [[]];
  while (queue.length > 0) {
    const path = queue.shift();
    if (path.length >= start.maximumMovement) {
      continue;
    }
    for (const candidate of getNextMovementSteps(
      state,
      side,
      creatureInstanceId,
      start.origin,
      path
    )) {
      const key = coordinateKey(candidate);
      if (visited.has(key)) {
        continue;
      }
      visited.add(key);
      const nextPath = [...path, candidate];
      paths.push(nextPath);
      queue.push(nextPath);
    }
  }
  return paths;
}
function getMovementCandidates(state, creatureInstanceId, expectedOrigin, provisionalPosition) {
  return getAdjacentBoardCoordinates(provisionalPosition).filter((candidate) => {
    if (!isNormalBoardCoordinate(candidate) || !getBoardSquare(state.board, candidate)) {
      return false;
    }
    const occupantId = getOccupantId(state.board, candidate);
    return !occupantId || occupantId === creatureInstanceId && sameCoordinate(candidate, expectedOrigin);
  });
}
function validateMovementStep(state, creatureInstanceId, expectedOrigin, from, step, index) {
  if (!isExistingBoardCoordinate(step) || !getBoardSquare(state.board, step)) {
    return {
      code: "battle.board.coordinate-invalid",
      message: "Movement paths must use existing board squares.",
      path: `path.${index}`
    };
  }
  if (!getAdjacentBoardCoordinates(from).some(
    (candidate) => sameCoordinate(candidate, step)
  )) {
    return {
      code: "battle.move.path-invalid",
      message: "Movement paths must use adjacent board squares.",
      path: `path.${index}`
    };
  }
  if (!isNormalBoardCoordinate(step)) {
    return {
      code: "battle.board.destination-invalid",
      message: "Movement paths cannot enter base squares.",
      path: `path.${index}`
    };
  }
  const occupantId = getOccupantId(state.board, step);
  if (occupantId && !(occupantId === creatureInstanceId && sameCoordinate(step, expectedOrigin))) {
    return {
      code: "battle.board.occupied",
      message: "Movement paths cannot enter occupied squares.",
      path: `path.${index}`
    };
  }
  return void 0;
}
function ineligible(creatureInstanceId, issues) {
  return {
    eligible: false,
    creatureInstanceId,
    candidateNextSteps: [],
    issues
  };
}

// packages/domain/src/battle/summon.ts
function querySummonStart(state, side, handInstanceId) {
  const sourceIssues = validateSummonSource(state, side, handInstanceId);
  if (sourceIssues.length > 0) {
    return ineligible2(handInstanceId, sourceIssues);
  }
  const candidateDestinations = collectSummonDestinations(state, side);
  const card = state.cardInstances[handInstanceId];
  const affordableDestinations = card ? candidateDestinations.filter((destination) => getCreaturePlayCost(state, side, card, getLane(destination.column)) <= state.players[side].currentPp) : [];
  if (affordableDestinations.length === 0) {
    if (candidateDestinations.length > 0) {
      return ineligible2(handInstanceId, [{
        code: "battle.resource.pp-insufficient",
        message: "Not enough PP to play this creature.",
        path: "currentPp"
      }]);
    }
    return ineligible2(handInstanceId, [
      {
        code: "battle.summon.no-destination",
        message: "No empty legal summon square is available.",
        path: "destination"
      }
    ]);
  }
  return {
    eligible: true,
    handInstanceId,
    candidateDestinations: affordableDestinations,
    issues: []
  };
}
function getSummonDestinations(state, side, handInstanceId) {
  const result = querySummonStart(state, side, handInstanceId);
  return result.eligible ? result.candidateDestinations : [];
}
function validateSummonSource(state, side, handInstanceId) {
  if (state.phase === "terminal" || state.terminalResult) {
    return [
      {
        code: "battle.terminal",
        message: "The battle has already ended."
      }
    ];
  }
  if (state.phase !== "play") {
    return [
      {
        code: "battle.phase.invalid",
        message: "Creatures can be summoned only during a play phase."
      }
    ];
  }
  if (state.activeSide !== side) {
    return [
      {
        code: "battle.side.inactive",
        message: "It is not this side's turn."
      }
    ];
  }
  const card = state.cardInstances[handInstanceId];
  if (!card) {
    return [
      {
        code: "battle.card.not-found",
        message: "The selected card no longer exists.",
        path: "handInstanceId"
      }
    ];
  }
  if (card.ownerSide !== side || !state.players[side].handZone.includes(card.instanceId)) {
    return [
      {
        code: "battle.card.owner-invalid",
        message: "The selected card is not in this side's hand.",
        path: "handInstanceId"
      }
    ];
  }
  if (card.zone !== "hand") {
    return [
      {
        code: "battle.card.zone-invalid",
        message: "The selected card is not in hand.",
        path: "handInstanceId"
      }
    ];
  }
  if (!isCreature(card)) {
    return [
      {
        code: "battle.card.type-invalid",
        message: "Only creature cards can be summoned.",
        path: "handInstanceId"
      }
    ];
  }
  return [];
}
function validateSummonDestination(state, side, destination) {
  if (!isExistingBoardCoordinate(destination) || !getBoardSquare(state.board, destination)) {
    return [
      {
        code: "battle.board.coordinate-invalid",
        message: "The selected square does not exist on the board.",
        path: "destination"
      }
    ];
  }
  if (!isNormalBoardCoordinate(destination)) {
    return [
      {
        code: "battle.board.destination-invalid",
        message: "Base squares cannot be used as summon destinations.",
        path: "destination"
      }
    ];
  }
  if (!getSummonRangeCoordinates(state, side).some((coordinate) => coordinateKey(coordinate) === coordinateKey(destination))) {
    return [
      {
        code: "battle.board.destination-invalid",
        message: "Creatures can be summoned only to a legal summon square.",
        path: "destination"
      }
    ];
  }
  if (getOccupantId(state.board, destination)) {
    return [
      {
        code: "battle.board.occupied",
        message: "The selected square is occupied.",
        path: "destination"
      }
    ];
  }
  return [];
}
function collectSummonDestinations(state, side) {
  return getSummonRangeCoordinates(state, side).filter(
    (coordinate) => !getOccupantId(state.board, coordinate)
  );
}
function getSummonRangeCoordinates(state, side) {
  const seen = /* @__PURE__ */ new Set();
  const candidates = [
    ...INITIAL_SUMMON_COORDINATES_BY_SIDE[side],
    ...getOwnedNeutralBases(state.bases, side).flatMap(
      (base) => getAdjacentBoardCoordinates(base.coordinate)
    )
  ];
  return candidates.filter((coordinate) => {
    const key = coordinateKey(coordinate);
    if (seen.has(key) || !isExistingBoardCoordinate(coordinate) || !isNormalBoardCoordinate(coordinate)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}
function isCreature(card) {
  return card.type === "creature" || card.type === "creature-token";
}
function ineligible2(handInstanceId, issues) {
  return {
    eligible: false,
    handInstanceId,
    candidateDestinations: [],
    issues
  };
}

// packages/domain/src/battle/effectPrograms.ts
function getExecutablePlayEffects(card) {
  return getExecutableEffects(card, "play");
}
function hasTargetedSummonEffect(card) {
  return TARGETED_SUMMON_CARD_IDS.has(card.catalogCardId);
}
function getExecutableEffects(card, trigger) {
  if (card.effectsDisabled) return [];
  if (card.effectIds.length === 0) return [];
  const lifecycle = LIFECYCLE_CARD_IDS[trigger];
  if (trigger !== "play" && !lifecycle.has(card.catalogCardId)) return [];
  if (card.catalogCardId === "AK-012") {
    return card.effectIds.map((effectId) => ({
      effectId,
      consumedOnFizzle: true,
      operations: [{
        kind: "card-script",
        cardId: card.catalogCardId,
        target: "enemy-creature-or-attackable-base",
        minimumTargets: 1,
        maximumTargets: 1,
        stopOnFailure: true
      }]
    }));
  }
  const damage = card.effectText.match(
    /敵クリーチャーまたは攻撃可能な拠点1つを選択する。その対象に(\d+)ダメージを与える。/
  );
  if (damage) {
    return card.effectIds.map((effectId) => ({
      effectId,
      consumedOnFizzle: true,
      operations: [{
        kind: "damage",
        target: "enemy-creature-or-attackable-base",
        amount: Number(damage[1]),
        minimumTargets: 1,
        maximumTargets: 1,
        stopOnFailure: true
      }]
    }));
  }
  if (card.effectText.includes("\u5473\u65B9\u30AF\u30EA\u30FC\u30C1\u30E3\u30FC\u307E\u305F\u306F\u81EA\u5206\u306E\u62E0\u70B91\u3064\u3092\u9078\u629E\u3059\u308B\u3002\u305D\u306E\u5BFE\u8C61\u306E\u4F53\u529B\u30923\u56DE\u5FA9\u3059\u308B\u3002")) {
    return card.effectIds.map((effectId) => ({
      effectId,
      consumedOnFizzle: true,
      operations: [{
        kind: "heal",
        target: "ally-creature-or-own-base",
        amount: 3,
        minimumTargets: 1,
        maximumTargets: 1,
        stopOnFailure: true
      }]
    }));
  }
  return card.effectIds.map((effectId) => ({
    effectId,
    consumedOnFizzle: true,
    operations: [{
      kind: "card-script",
      cardId: card.catalogCardId,
      target: "any-creature",
      minimumTargets: TARGETED_CREATURE_SCRIPT_IDS.has(card.catalogCardId) ? 1 : 0,
      maximumTargets: 64
    }]
  }));
}
var LIFECYCLE_CARD_IDS = {
  play: /* @__PURE__ */ new Set(),
  summon: /* @__PURE__ */ new Set(["AK-003", "AK-006", "AK-007", "AK-016", "AK-018", "AK-020", "AK-024", "AK-027", "AK-032", "AK-034", "AK-038", "AK-042", "AK-045", "AK-046", "AK-048", "AK-052", "AK-057", "AK-060"]),
  moved: /* @__PURE__ */ new Set(["AK-022"]),
  destroyed: /* @__PURE__ */ new Set(["AK-010", "AK-049", "AK-051", "AK-056", "AK-058"])
};
var TARGETED_CREATURE_SCRIPT_IDS = /* @__PURE__ */ new Set([
  "AK-006",
  "AK-015",
  "AK-018",
  "AK-020",
  "AK-039",
  "AK-041",
  "AK-050",
  "AK-052",
  "AK-055"
]);
var TARGETED_SUMMON_CARD_IDS = /* @__PURE__ */ new Set([
  "AK-003",
  "AK-006",
  "AK-007",
  "AK-012",
  "AK-018",
  "AK-020",
  "AK-038",
  "AK-042",
  "AK-046",
  "AK-048",
  "AK-052",
  "AK-057"
]);

// packages/domain/src/battle/terminal.ts
function hasAllNeutralBases(bases, side) {
  return BATTLE_BASE_IDS.filter(
    (baseId) => getBattleBaseById(bases, baseId).kind === "neutral-base"
  ).every((baseId) => getBattleBaseById(bases, baseId).owner === side);
}
function evaluateBattleTerminal(state, trigger, finalEventSequence) {
  if (state.terminalResult) {
    return state.terminalResult;
  }
  const outcome = evaluateTrigger(state, trigger);
  if (!outcome) {
    return void 0;
  }
  return {
    winner: outcome.winner,
    loser: oppositeSide(outcome.winner),
    reason: outcome.reason,
    turnNumber: state.metadata.turnNumber,
    elapsedSeconds: state.metadata.elapsedSeconds,
    finalEventSequence
  };
}
function applyTerminalResult(state, result, sequence) {
  if (state.terminalResult) {
    return {
      state,
      events: [],
      nextSequence: sequence
    };
  }
  const terminalResult = {
    ...result,
    finalEventSequence: sequence
  };
  const event2 = {
    sequence,
    type: "battle.ended",
    side: terminalResult.winner,
    message: terminalMessage(terminalResult),
    data: {
      winner: terminalResult.winner,
      loser: terminalResult.loser,
      reason: terminalResult.reason
    }
  };
  return {
    state: {
      ...state,
      phase: "terminal",
      terminalResult,
      eventCursor: sequence
    },
    events: [event2],
    nextSequence: sequence + 1
  };
}
function evaluateTrigger(state, trigger) {
  switch (trigger.kind) {
    case "player-base-damaged": {
      const opponent = oppositeSide(trigger.attackingSide);
      const base = getBattleBaseById(state.bases, trigger.baseId);
      if (trigger.baseId === getPlayerBaseId(opponent) && base.kind === "player-base" && base.currentHp <= 0) {
        return { winner: trigger.attackingSide, reason: "base-destroyed" };
      }
      return void 0;
    }
    case "neutral-base-captured":
      return hasAllNeutralBases(state.bases, trigger.capturingSide) ? { winner: trigger.capturingSide, reason: "neutral-bases-controlled" } : void 0;
    case "draw-failed":
      return { winner: oppositeSide(trigger.losingSide), reason: "deck-out" };
    case "quit":
      return { winner: oppositeSide(trigger.losingSide), reason: "quit" };
  }
}
function terminalMessage(result) {
  switch (result.reason) {
    case "base-destroyed":
      return `${labelSide2(result.winner)} won by destroying the opposing base.`;
    case "neutral-bases-controlled":
      return `${labelSide2(result.winner)} won by controlling all neutral bases.`;
    case "deck-out":
      return `${labelSide2(result.winner)} won by deck-out.`;
    case "quit":
      return `${labelSide2(result.winner)} won after the opponent quit.`;
  }
}
function oppositeSide(side) {
  return side === "player" ? "cpu" : "player";
}
function labelSide2(side) {
  return side === "player" ? "Player" : "CPU";
}

// packages/domain/src/battle/baseCombat.ts
function isBaseAttackable(base, attackingSide) {
  return base.owner !== attackingSide;
}
function applyBaseDamage(state, attackingSide, attackerId, baseId, damage, sequence) {
  const base = getBattleBaseById(state.bases, baseId);
  if (!isBaseAttackable(base, attackingSide)) {
    return { state, events: [], nextSequence: sequence };
  }
  const appliedDamage = Math.max(0, damage);
  const remainingHp = Math.max(0, Math.min(base.maxHp, base.currentHp - appliedDamage));
  const damagedState = {
    ...state,
    bases: updateBattleBase(state.bases, baseId, (current) => ({
      ...current,
      currentHp: remainingHp
    })),
    eventCursor: sequence
  };
  const damageEvent = {
    sequence,
    type: "base.damaged",
    side: attackingSide,
    instanceId: attackerId,
    message: `${labelSide3(attackingSide)} dealt ${appliedDamage} damage to ${baseId}.`,
    data: {
      attackerId,
      baseId,
      damage: appliedDamage,
      remainingHp
    }
  };
  let resolution = {
    state: damagedState,
    events: [damageEvent],
    nextSequence: sequence + 1
  };
  if (remainingHp > 0) {
    return resolution;
  }
  if (base.kind === "neutral-base") {
    const capture = captureNeutralBase(
      resolution.state,
      attackingSide,
      baseId,
      resolution.nextSequence
    );
    resolution = compose(resolution, capture);
    return appendTerminalIfNeeded(resolution, {
      kind: "neutral-base-captured",
      capturingSide: attackingSide,
      baseId
    });
  }
  return appendTerminalIfNeeded(resolution, {
    kind: "player-base-damaged",
    attackingSide,
    baseId
  });
}
function captureNeutralBase(state, side, baseId, sequence) {
  const base = getBattleBaseById(state.bases, baseId);
  if (base.kind !== "neutral-base" || base.owner === side) {
    return { state, events: [], nextSequence: sequence };
  }
  const nextState = {
    ...state,
    bases: updateBattleBase(state.bases, baseId, (current) => ({
      ...current,
      owner: side,
      currentHp: current.maxHp
    })),
    eventCursor: sequence
  };
  const event2 = {
    sequence,
    type: "base.captured",
    side,
    message: `${labelSide3(side)} captured ${baseId}.`,
    data: {
      baseId,
      previousOwner: base.owner,
      newOwner: side,
      restoredHp: base.maxHp
    }
  };
  return {
    state: nextState,
    events: [event2],
    nextSequence: sequence + 1
  };
}
function appendTerminalIfNeeded(resolution, trigger) {
  const terminal = evaluateBattleTerminal(
    resolution.state,
    trigger,
    resolution.nextSequence
  );
  if (!terminal || resolution.state.terminalResult) {
    return resolution;
  }
  return compose(
    resolution,
    applyTerminalResult(resolution.state, terminal, resolution.nextSequence)
  );
}
function compose(previous, next) {
  return {
    state: next.state,
    events: [...previous.events, ...next.events],
    nextSequence: next.nextSequence
  };
}
function labelSide3(side) {
  return side === "player" ? "Player" : "CPU";
}

// packages/domain/src/battle/attack.ts
function listAttackersInBoardOrder(state, side) {
  return Object.values(state.cardInstances).filter((card) => isBoardCreature(card) && card.controllerSide === side).sort(compareBoardEntry).map((card) => card.instanceId);
}
function isWithinBasicAttackRange(origin, target) {
  return isAdjacentStep(origin, target);
}
function snapshotAttackTargets(state, attackerId) {
  const attacker = state.cardInstances[attackerId];
  if (!attacker || !isBoardCreature(attacker) || !attacker.position) {
    return { attackerId, targets: [] };
  }
  const adjacentKeys = new Set(
    getAdjacentBoardCoordinates(attacker.position).map(coordinateKey2)
  );
  const creatures = Object.values(state.cardInstances).filter(
    (card) => isBoardCreature(card) && card.controllerSide !== attacker.controllerSide && card.position !== void 0 && adjacentKeys.has(coordinateKey2(card.position))
  ).sort(compareBoardEntry).map((card) => ({ kind: "creature", instanceId: card.instanceId }));
  const bases = BATTLE_BASE_IDS.map(
    (baseId) => getBattleBaseById(state.bases, baseId)
  ).filter(
    (base) => isBaseAttackable(base, attacker.controllerSide) && adjacentKeys.has(coordinateKey2(base.coordinate))
  ).map((base) => ({ kind: "base", baseId: base.id }));
  return {
    attackerId,
    targets: [...creatures, ...bases]
  };
}
function validateAttackTarget(state, attackingSide, attackerId, target) {
  const attacker = state.cardInstances[attackerId];
  if (!attacker || !isBoardCreature(attacker) || !attacker.position) {
    return { valid: false, reason: "attacker-unavailable" };
  }
  if (target.kind === "creature") {
    const creature = state.cardInstances[target.instanceId];
    if (!creature) {
      return { valid: false, reason: "target-missing" };
    }
    if (!isBoardCreature(creature) || !creature.position) {
      return { valid: false, reason: "target-left-board" };
    }
    if (creature.controllerSide === attackingSide) {
      return { valid: false, reason: "target-no-longer-enemy" };
    }
    if (!isWithinBasicAttackRange(attacker.position, creature.position)) {
      return { valid: false, reason: "target-out-of-range" };
    }
    return { valid: true, attacker, target: creature };
  }
  const base = state.bases[target.baseId];
  if (!base) {
    return { valid: false, reason: "target-missing" };
  }
  if (!isBaseAttackable(base, attackingSide)) {
    return { valid: false, reason: "target-no-longer-enemy" };
  }
  if (!isWithinBasicAttackRange(attacker.position, base.coordinate)) {
    return { valid: false, reason: "target-out-of-range" };
  }
  return { valid: true, attacker, target: base };
}
function applyCreatureDamage(state, attacker, targetId2, damage, sequence) {
  const target = state.cardInstances[targetId2];
  if (!target || !isBoardCreature(target)) {
    return { state, events: [], nextSequence: sequence };
  }
  const appliedDamage = Math.max(0, damage);
  const remainingHp = Math.max(0, (target.currentHp ?? target.maxHp ?? 0) - appliedDamage);
  const damagedState = {
    ...state,
    cardInstances: {
      ...state.cardInstances,
      [targetId2]: {
        ...target,
        currentHp: remainingHp
      }
    },
    eventCursor: sequence
  };
  const damageEvent = {
    sequence,
    type: "creature.damaged",
    side: attacker.controllerSide,
    instanceId: attacker.instanceId,
    message: `${attacker.name} dealt ${appliedDamage} damage to ${target.name}.`,
    data: {
      attackerId: attacker.instanceId,
      targetId: targetId2,
      damage: appliedDamage,
      remainingHp
    }
  };
  const damageResolution = {
    state: damagedState,
    events: [damageEvent],
    nextSequence: sequence + 1
  };
  if (remainingHp > 0) {
    return damageResolution;
  }
  return compose2(
    damageResolution,
    destroyCreature(damagedState, targetId2, sequence + 1)
  );
}
function destroyCreature(state, targetId2, sequence) {
  const target = state.cardInstances[targetId2];
  if (!target || !isBoardCreature(target) || !target.position) {
    return { state, events: [], nextSequence: sequence };
  }
  const { position, boardEntrySequence: _boardEntrySequence, ...remainingCard } = target;
  const controller = state.players[target.controllerSide];
  const nextGraveyard = controller.graveyardZone.includes(targetId2) ? controller.graveyardZone : [...controller.graveyardZone, targetId2];
  const nextState = {
    ...state,
    board: setBoardOccupant(state.board, position, void 0),
    players: {
      ...state.players,
      [target.controllerSide]: {
        ...controller,
        graveyardZone: nextGraveyard
      }
    },
    cardInstances: {
      ...state.cardInstances,
      [targetId2]: {
        ...remainingCard,
        zone: "graveyard",
        currentHp: 0
      }
    },
    eventCursor: sequence
  };
  const event2 = {
    sequence,
    type: "creature.destroyed",
    side: target.controllerSide,
    instanceId: targetId2,
    message: `${target.name} was destroyed.`,
    data: {
      targetId: targetId2,
      controllerSide: target.controllerSide,
      previousColumn: position.column,
      previousRow: position.row
    }
  };
  return resolveDarkResonance(nextState, target, position, event2, sequence + 1);
}
function resolveDarkResonance(state, destroyed, position, destroyedEvent, nextSequence) {
  const side = destroyed.controllerSide;
  const lane = getLane(position.column);
  const player = state.players[side];
  if (!isResonanceActive(player.resonance, lane, "dark") || player.resonanceUsage.dark[lane]) {
    return { state, events: [destroyedEvent], nextSequence };
  }
  const tokenId = `dark-resonance-${side}-${nextSequence}`;
  const token = {
    instanceId: tokenId,
    catalogCardId: "AK-T-002",
    ownerSide: side,
    controllerSide: side,
    zone: "board",
    name: "Shade Remnant",
    type: "creature-token",
    attribute: "dark",
    cost: 1,
    currentCost: 1,
    attack: 1,
    currentAttack: 1,
    health: 1,
    currentHp: 1,
    maxHp: 1,
    movement: 1,
    isToken: true,
    effectText: "",
    effectIds: [],
    position,
    boardEntrySequence: nextSequence,
    summonedThisTurn: false,
    movedThisTurn: false
  };
  return {
    state: { ...state, board: setBoardOccupant(state.board, position, tokenId), players: { ...state.players, [side]: { ...player, resonanceUsage: { ...player.resonanceUsage, dark: { ...player.resonanceUsage.dark, [lane]: true } } } }, cardInstances: { ...state.cardInstances, [tokenId]: token }, eventCursor: nextSequence },
    events: [destroyedEvent, { sequence: nextSequence, type: "resonance.effect-resolved", side, instanceId: tokenId, message: "Dark resonance summoned a token." }],
    nextSequence: nextSequence + 1
  };
}
function resolveCreatureAttack(state, snapshot, sequence) {
  const initialAttacker = state.cardInstances[snapshot.attackerId];
  if (!initialAttacker || !isBoardCreature(initialAttacker)) {
    return {
      state,
      events: [attackerSkippedEvent(sequence, snapshot.attackerId)],
      nextSequence: sequence + 1
    };
  }
  const attack = getEffectiveCreatureAttack(state, initialAttacker);
  const startedEvent = {
    sequence,
    type: "attack.attacker-started",
    side: initialAttacker.controllerSide,
    instanceId: initialAttacker.instanceId,
    message: `${initialAttacker.name} started attacking.`,
    data: {
      attackerId: initialAttacker.instanceId,
      attack,
      targetCount: snapshot.targets.length
    }
  };
  let resolution = {
    state: { ...state, eventCursor: sequence },
    events: [startedEvent],
    nextSequence: sequence + 1
  };
  for (const target of snapshot.targets) {
    if (resolution.state.terminalResult) {
      break;
    }
    const targetedEvent = createTargetedEvent(
      resolution.nextSequence,
      initialAttacker,
      target
    );
    resolution = appendEvent(resolution, targetedEvent);
    const validation = validateAttackTarget(
      resolution.state,
      initialAttacker.controllerSide,
      initialAttacker.instanceId,
      target
    );
    if (!validation.valid) {
      resolution = appendEvent(
        resolution,
        createTargetSkippedEvent(
          resolution.nextSequence,
          initialAttacker,
          target,
          validation.reason
        )
      );
      if (validation.reason === "attacker-unavailable") {
        break;
      }
      continue;
    }
    const currentAttack = getEffectiveCreatureAttack(resolution.state, validation.attacker);
    const damageResolution = target.kind === "creature" ? applyCreatureDamage(
      resolution.state,
      validation.attacker,
      target.instanceId,
      currentAttack,
      resolution.nextSequence
    ) : applyBaseDamage(
      resolution.state,
      initialAttacker.controllerSide,
      initialAttacker.instanceId,
      target.baseId,
      currentAttack,
      resolution.nextSequence
    );
    resolution = compose2(resolution, damageResolution);
  }
  return resolution;
}
function resolveAttackPhase(state, side, firstSequence) {
  if (state.terminalResult) {
    return { state, events: [] };
  }
  const attackerIds = listAttackersInBoardOrder(state, side);
  const phaseStarted = {
    sequence: firstSequence,
    type: "attack.phase-started",
    side,
    message: `${labelSide4(side)} attack phase started.`,
    data: { attackerCount: attackerIds.length }
  };
  let resolution = {
    state: {
      ...state,
      phase: "automatic",
      eventCursor: firstSequence
    },
    events: [phaseStarted],
    nextSequence: firstSequence + 1
  };
  for (const attackerId of attackerIds) {
    if (resolution.state.terminalResult) {
      break;
    }
    const attacker = resolution.state.cardInstances[attackerId];
    if (!attacker || !isBoardCreature(attacker)) {
      resolution = appendEvent(
        resolution,
        attackerSkippedEvent(resolution.nextSequence, attackerId, side)
      );
      continue;
    }
    const snapshot = snapshotAttackTargets(resolution.state, attackerId);
    resolution = compose2(
      resolution,
      resolveCreatureAttack(resolution.state, snapshot, resolution.nextSequence)
    );
  }
  if (!resolution.state.terminalResult) {
    resolution = appendEvent(resolution, {
      sequence: resolution.nextSequence,
      type: "attack.phase-ended",
      side,
      message: `${labelSide4(side)} attack phase ended.`
    });
  }
  return {
    state: resolution.state,
    events: resolution.events
  };
}
function isBoardCreature(card) {
  return card.zone === "board" && card.type !== "spell" && card.position !== void 0;
}
function compareBoardEntry(left, right) {
  const sequenceDifference = (left.boardEntrySequence ?? Number.MAX_SAFE_INTEGER) - (right.boardEntrySequence ?? Number.MAX_SAFE_INTEGER);
  return sequenceDifference || left.instanceId.localeCompare(right.instanceId, "en");
}
function createTargetedEvent(sequence, attacker, target) {
  return {
    sequence,
    type: "attack.targeted",
    side: attacker.controllerSide,
    instanceId: attacker.instanceId,
    message: `${attacker.name} targeted ${targetId(target)}.`,
    data: targetData(attacker.instanceId, target)
  };
}
function createTargetSkippedEvent(sequence, attacker, target, reason) {
  return {
    sequence,
    type: "attack.target-skipped",
    side: attacker.controllerSide,
    instanceId: attacker.instanceId,
    message: `${attacker.name} skipped ${targetId(target)}.`,
    data: {
      ...targetData(attacker.instanceId, target),
      reason
    }
  };
}
function attackerSkippedEvent(sequence, attackerId, side) {
  return {
    sequence,
    type: "attack.attacker-skipped",
    side,
    instanceId: attackerId,
    message: `Attacker ${attackerId} was unavailable.`,
    data: {
      attackerId,
      reason: "attacker-unavailable"
    }
  };
}
function targetData(attackerId, target) {
  return {
    attackerId,
    targetKind: target.kind,
    targetId: targetId(target)
  };
}
function targetId(target) {
  return target.kind === "creature" ? target.instanceId : target.baseId;
}
function appendEvent(resolution, event2) {
  return {
    state: { ...resolution.state, eventCursor: event2.sequence },
    events: [...resolution.events, event2],
    nextSequence: event2.sequence + 1
  };
}
function compose2(previous, next) {
  return {
    state: next.state,
    events: [...previous.events, ...next.events],
    nextSequence: next.nextSequence
  };
}
function coordinateKey2(coordinate) {
  return `${coordinate.column}:${coordinate.row}`;
}
function labelSide4(side) {
  return side === "player" ? "Player" : "CPU";
}

// packages/domain/src/battle/cardEffectRuntime.ts
var SUPPORTED_CARD_SCRIPT_IDS = /* @__PURE__ */ new Set([
  "AK-004",
  "AK-006",
  "AK-008",
  "AK-009",
  "AK-010",
  "AK-011",
  "AK-012",
  "AK-013",
  "AK-015",
  "AK-016",
  "AK-017",
  "AK-018",
  "AK-019",
  "AK-020",
  "AK-021",
  "AK-022",
  "AK-023",
  "AK-024",
  "AK-025",
  "AK-026",
  "AK-027",
  "AK-028",
  "AK-029",
  "AK-030",
  "AK-031",
  "AK-032",
  "AK-033",
  "AK-034",
  "AK-036",
  "AK-038",
  "AK-039",
  "AK-041",
  "AK-042",
  "AK-043",
  "AK-044",
  "AK-045",
  "AK-046",
  "AK-047",
  "AK-048",
  "AK-049",
  "AK-050",
  "AK-051",
  "AK-052",
  "AK-054",
  "AK-055",
  "AK-056",
  "AK-057",
  "AK-058",
  "AK-059",
  "AK-060"
]);
function isCardEffectScriptSupported(cardId) {
  return SUPPORTED_CARD_SCRIPT_IDS.has(cardId);
}
function resolveCardEffectScript(state, context, cardId, firstSequence) {
  const selected = selectedCreatures(state, context);
  switch (cardId) {
    case "AK-006":
      return withEvent(buffCreatures(state, selected.filter((card) => card.instanceId !== context.sourceInstanceId && card.controllerSide === context.controllerSide).slice(0, 1), { attack: 2 }), context, firstSequence, "Summon ally gained attack.");
    case "AK-015":
      return drawCards(buffCreatures(state, selected, { movement: 1 }), context, 1, firstSequence);
    case "AK-016":
      return drawCards(state, context, 1, firstSequence);
    case "AK-008":
      return withEvent(buffLaneAllies(state, context, { attack: 2 }), context, firstSequence, "Lane allies gained attack.");
    case "AK-011":
      return damageLaneEnemiesAndBases(state, context, selectedLane(context), 5, firstSequence);
    case "AK-012":
      return resolveVargas(state, context, firstSequence);
    case "AK-017":
      return drawCards(state, context, 2, firstSequence);
    case "AK-018":
      return moveSelected(state, context, selected.filter((card) => card.instanceId !== context.sourceInstanceId && card.controllerSide === context.controllerSide).slice(0, 1), firstSequence);
    case "AK-023":
      return drawCards(setEnemyMovement(state, context, 0), context, 3, firstSequence);
    case "AK-024":
      return returnSelected(state, context, laneCreaturesExceptSource(state, context), firstSequence);
    case "AK-026":
      return drawMatchingDeckCard(state, context, (card) => isCreature2(card), firstSequence);
    case "AK-027":
      return withEvent(increaseMaxPp(state, context, 1), context, firstSequence, "Maximum PP increased.");
    case "AK-029":
      return drawIfMaxPp(increaseMaxPp(state, context, 1), context, 7, firstSequence);
    case "AK-025":
      return withEvent(state.players[context.controllerSide].maxPp >= 5 ? buffCreatures(state, [state.cardInstances[context.sourceInstanceId]], { attack: 1, health: 1 }) : state, context, firstSequence, "Conditional summon bonus resolved.");
    case "AK-030":
      return withEvent(state.players[context.controllerSide].maxPp >= 7 ? buffCreatures(state, [state.cardInstances[context.sourceInstanceId]], { attack: 2, health: 2 }) : state, context, firstSequence, "Conditional summon bonus resolved.");
    case "AK-031":
      return drawMatchingDeckCard(state, context, (card) => isCreature2(card) && card.cost >= 8, firstSequence, -3);
    case "AK-032":
      return withEvent(state.players[context.controllerSide].maxPp >= 8 ? buffCreatures(state, laneCreaturesExceptSource(state, context).filter((card) => card.controllerSide === context.controllerSide), { attack: 2, health: 2 }) : state, context, firstSequence, "Conditional lane bonus resolved.");
    case "AK-033":
      return withEvent(state, context, firstSequence, "Hand creature cost aura is active.");
    case "AK-034":
      return state.players[context.controllerSide].maxPp >= 10 ? drawMatchingDeckCard(state, context, (card) => isCreature2(card) && card.cost <= 4, firstSequence, void 0, 0) : withEvent(state, context, firstSequence, "Maximum PP condition was not met.");
    case "AK-039":
      return withEvent(buffCreatures(state, selected, { health: 4 }), context, firstSequence, "Sacred Shield reinforced its target.");
    case "AK-041":
      return withEvent(disableCreatures(state, selected), context, firstSequence, "Holy Silence disabled the target effect.");
    case "AK-038":
    case "AK-042":
      return summonTokens(state, context, "AK-T-001", selectedCoordinates(context).slice(0, 1), firstSequence);
    case "AK-044":
      return summonTokensThenBuff(state, context, "AK-T-001", selectedCoordinates(context), { health: 2 }, firstSequence);
    case "AK-045":
      return withEvent(disableCreatures(state, laneCreaturesExceptSource(state, context).filter((card) => card.controllerSide !== context.controllerSide)), context, firstSequence, "Lane enemy effects were disabled.");
    case "AK-046":
      return summonTokens(state, context, "AK-T-001", selectedCoordinates(context).slice(0, 2), firstSequence);
    case "AK-048":
      return summonTokensThenBuff(state, context, "AK-T-001", selectedCoordinates(context).slice(0, 3), { attack: 3, health: 3 }, firstSequence);
    case "AK-047":
      return withEvent(buffAllies(disableEnemies(state, context), context, { attack: 1, health: 4 }), context, firstSequence, "Divine Dominion resolved.");
    case "AK-050":
      return destroySelected(state, context, selected, 2, firstSequence);
    case "AK-055":
      return destroySelected(state, context, selected, 0, firstSequence);
    case "AK-019":
      return moveSelected(state, context, selected, firstSequence);
    case "AK-020":
      return returnSelected(state, context, selected, firstSequence);
    case "AK-022":
      return drawOncePerTurn(state, context, firstSequence);
    case "AK-054":
      return returnGraveyardCards(state, context, firstSequence);
    case "AK-057":
      return reviveSelected(state, context, firstSequence);
    case "AK-059":
      return reviveSelectedPair(state, context, firstSequence);
    case "AK-049":
      return drawCards(state, context, 1, firstSequence);
    case "AK-056":
      return withEvent(buffCreatures(state, [state.cardInstances[context.sourceInstanceId]], { attack: 1, health: 1 }), context, firstSequence, "A fallen ally strengthened this creature.");
    case "AK-010":
      return destroyLaneBlast(state, context, firstSequence);
    case "AK-051":
      return summonAdjacentToken(state, context, "AK-T-002", firstSequence);
    case "AK-052":
      return buffAfterDestroyingSelected(state, context, selected.filter((card) => card.instanceId !== context.sourceInstanceId && card.controllerSide === context.controllerSide).slice(0, 1), firstSequence);
    case "AK-058":
      return reviveRandomAdjacent(state, context, firstSequence);
    case "AK-060":
      return destroyLaneAndGrowSource(state, context, firstSequence);
    case "AK-004":
    case "AK-009":
    case "AK-013":
    case "AK-021":
    case "AK-028":
    case "AK-036":
    case "AK-043":
      return withEvent(state, context, firstSequence, `${cardId} intrinsic effect resolved.`);
    default:
      return void 0;
  }
}
function selectedCreatures(state, context) {
  const ids = context.selection.kind === "creatures" ? context.selection.instanceIds : context.selection.kind === "structured" ? context.selection.value.creatureIds ?? [] : [];
  return [...new Set(ids)].sort().map((id) => state.cardInstances[id]).filter((card) => Boolean(card && card.zone === "board"));
}
function selectedBaseId(context) {
  return context.selection.kind === "base" ? context.selection.baseId : context.selection.kind === "structured" ? context.selection.value.baseIds?.[0] : void 0;
}
function selectedCoordinates(context) {
  return context.selection.kind === "structured" ? context.selection.value.coordinates ?? [] : [];
}
function selectedLane(context) {
  return context.selection.kind === "structured" ? context.selection.value.lane : void 0;
}
function buffCreatures(state, cards, bonus) {
  if (cards.length === 0) return state;
  return { ...state, cardInstances: { ...state.cardInstances, ...Object.fromEntries(cards.map((card) => [card.instanceId, {
    ...card,
    currentAttack: (card.currentAttack ?? card.attack ?? 0) + (bonus.attack ?? 0),
    maxHp: (card.maxHp ?? card.currentHp ?? 0) + (bonus.health ?? 0),
    currentHp: (card.currentHp ?? 0) + (bonus.health ?? 0),
    temporaryMovementBonus: (card.temporaryMovementBonus ?? 0) + (bonus.movement ?? 0)
  }])) } };
}
function setEnemyMovement(state, context, movement) {
  return { ...state, cardInstances: Object.fromEntries(Object.entries(state.cardInstances).map(([id, card]) => [id, card.zone === "board" && card.controllerSide !== context.controllerSide ? { ...card, movementOverride: movement, movementOverrideExpiresOnSide: context.controllerSide } : card])) };
}
function increaseMaxPp(state, context, amount) {
  const player = state.players[context.controllerSide];
  const maxPp = Math.min(BATTLE_MAX_PP, player.maxPp + amount);
  return { ...state, players: { ...state.players, [context.controllerSide]: { ...player, maxPp } } };
}
function drawIfMaxPp(state, context, threshold, sequence) {
  return state.players[context.controllerSide].maxPp >= threshold ? drawCards(state, context, 1, sequence) : withEvent(state, context, sequence, "Maximum PP condition was not met.");
}
function drawCards(state, context, amount, firstSequence) {
  let next = state;
  const events = [];
  for (let index = 0; index < amount; index += 1) {
    const player = next.players[context.controllerSide];
    const id = player.deckZone[0];
    if (!id) break;
    const overflow = player.handZone.length >= 9;
    next = { ...next, players: { ...next.players, [context.controllerSide]: { ...player, deckZone: player.deckZone.slice(1), handZone: overflow ? player.handZone : [...player.handZone, id], graveyardZone: overflow ? [...player.graveyardZone, id] : player.graveyardZone } }, cardInstances: { ...next.cardInstances, [id]: { ...next.cardInstances[id], zone: overflow ? "graveyard" : "hand" } } };
    events.push(event(context, firstSequence + events.length, overflow ? "card.overflowed" : "card.drawn", id, "Card effect drew a card."));
  }
  return events.length ? { state: next, events } : withEvent(next, context, firstSequence, "Card effect had no drawable cards.");
}
function drawMatchingDeckCard(state, context, predicate, sequence, costDelta, setCost) {
  const player = state.players[context.controllerSide];
  const candidates = player.deckZone.filter((candidate) => predicate(state.cardInstances[candidate])).sort();
  const [choice, rng] = createRngFromState(state.metadata.rng).nextInt(candidates.length);
  const id = candidates[choice];
  if (!id) return withEvent(state, context, sequence, "No matching deck card was available.");
  const card = state.cardInstances[id];
  const currentCost = setCost ?? Math.max(0, card.currentCost + (costDelta ?? 0));
  return { state: { ...state, metadata: { ...state.metadata, rng: rng.state }, players: { ...state.players, [context.controllerSide]: { ...player, deckZone: player.deckZone.filter((candidate) => candidate !== id), handZone: [...player.handZone, id] } }, cardInstances: { ...state.cardInstances, [id]: { ...card, zone: "hand", currentCost } } }, events: [event(context, sequence, "card.drawn", id, "Card effect added a matching card to hand.")] };
}
function disableCreatures(state, cards) {
  return { ...state, cardInstances: { ...state.cardInstances, ...Object.fromEntries(cards.map((card) => [card.instanceId, { ...card, effectsDisabled: true }])) } };
}
function disableEnemies(state, context) {
  return disableCreatures(state, Object.values(state.cardInstances).filter((card) => card.zone === "board" && card.controllerSide !== context.controllerSide));
}
function buffAllies(state, context, bonus) {
  return buffCreatures(state, Object.values(state.cardInstances).filter((card) => card.zone === "board" && card.controllerSide === context.controllerSide), bonus);
}
function destroySelected(state, context, cards, draws, sequence) {
  let next = state;
  const events = [];
  for (const card of cards) {
    const result = destroyCreature(next, card.instanceId, sequence + events.length);
    next = result.state;
    events.push(...result.events);
  }
  const drawn = cards.length && draws ? drawCards(next, context, draws, sequence + events.length) : void 0;
  return drawn ? { state: drawn.state, events: [...events, ...drawn.events] } : events.length ? { state: next, events } : withEvent(next, context, sequence, "No selected creature could be destroyed.");
}
function buffAfterDestroyingSelected(state, context, cards, sequence) {
  const destroyed = destroySelected(state, context, cards, 0, sequence);
  if (!destroyed.events.some((entry) => entry.type === "creature.destroyed")) return destroyed;
  const source = destroyed.state.cardInstances[context.sourceInstanceId];
  const buffedState = source ? buffCreatures(destroyed.state, [source], { attack: 3, health: 3 }) : destroyed.state;
  return { state: buffedState, events: [...destroyed.events, event(context, sequence + destroyed.events.length, "spell.resolved", context.sourceInstanceId, "Summoner gained strength after destroying an ally.")] };
}
function destroyLaneAndGrowSource(state, context, sequence) {
  const source = state.cardInstances[context.sourceInstanceId];
  if (!source?.position || source.zone !== "board") return withEvent(state, context, sequence, "Source was no longer on the board.");
  const victims = [...laneCreaturesExceptSource(state, context)].sort((left, right) => left.instanceId.localeCompare(right.instanceId));
  let next = state;
  const events = [];
  for (const victim of victims) {
    if (next.cardInstances[victim.instanceId]?.zone !== "board") continue;
    const destroyed = destroyCreature(next, victim.instanceId, sequence + events.length);
    next = destroyed.state;
    events.push(...destroyed.events);
  }
  const grownSource = next.cardInstances[context.sourceInstanceId];
  if (grownSource?.zone === "board" && events.filter((entry) => entry.type === "creature.destroyed").length > 0) {
    const destroyedCount = events.filter((entry) => entry.type === "creature.destroyed").length;
    next = buffCreatures(next, [grownSource], { attack: destroyedCount, health: destroyedCount });
    events.push(event(context, sequence + events.length, "spell.resolved", grownSource.instanceId, `Destroyed ${destroyedCount} lane creature(s); source gained +${destroyedCount}/+${destroyedCount}.`));
  }
  return events.length ? { state: next, events } : withEvent(next, context, sequence, "No other lane creatures could be destroyed.");
}
function damageCreatures(state, context, cards, amount, sequence) {
  let next = state;
  const events = [];
  for (const source of cards) {
    const card = next.cardInstances[source.instanceId];
    if (!card || card.zone !== "board") continue;
    const currentHp = Math.max(0, (card.currentHp ?? card.maxHp ?? 0) - amount);
    next = { ...next, cardInstances: { ...next.cardInstances, [card.instanceId]: { ...card, currentHp } } };
    events.push(event(context, sequence + events.length, "creature.damaged", card.instanceId, `Card effect dealt ${amount} damage.`));
    if (currentHp === 0) {
      const destroyed = destroyCreature(next, card.instanceId, sequence + events.length);
      next = destroyed.state;
      events.push(...destroyed.events);
    }
  }
  return events.length ? { state: next, events } : withEvent(next, context, sequence, "No damage targets were legal.");
}
function damageLaneEnemiesAndBases(state, context, lane, amount, sequence) {
  if (!lane) return withEvent(state, context, sequence, "No lane was selected.");
  const creatures = damageCreatures(state, context, Object.values(state.cardInstances).filter((card) => card.zone === "board" && card.controllerSide !== context.controllerSide && card.position && getLane(card.position.column) === lane), amount, sequence);
  let next = creatures.state;
  const events = [...creatures.events];
  for (const baseId of BATTLE_BASE_IDS) {
    const base = getBattleBaseById(next.bases, baseId);
    if (base.currentHp <= 0 || base.owner === context.controllerSide || getLane(base.coordinate.column) !== lane) continue;
    const damaged = applyBaseDamage(next, context.controllerSide, context.sourceInstanceId, baseId, amount, sequence + events.length);
    next = damaged.state;
    events.push(...damaged.events);
  }
  return { state: next, events };
}
function resolveVargas(state, context, sequence) {
  const target = selectedCreatures(state, context).find((card) => card.controllerSide !== context.controllerSide);
  if (!target) {
    const baseId = selectedBaseId(context);
    return baseId ? (() => {
      const damaged = applyBaseDamage(state, context.controllerSide, context.sourceInstanceId, baseId, 7, sequence);
      return { state: damaged.state, events: damaged.events };
    })() : withEvent(state, context, sequence, "No enemy target was selected.");
  }
  const initial = damageCreatures(state, context, [target], 7, sequence);
  const destroyed = initial.events.find((event2) => event2.type === "creature.destroyed" && event2.instanceId === target.instanceId);
  const column = destroyed?.data?.previousColumn;
  if (typeof column !== "number") return initial;
  const splash = damageCreatures(initial.state, context, Object.values(initial.state.cardInstances).filter((card) => card.zone === "board" && card.controllerSide !== context.controllerSide && card.instanceId !== target.instanceId && card.position && getLane(card.position.column) === getLane(column)), 3, sequence + initial.events.length);
  return { state: splash.state, events: [...initial.events, ...splash.events] };
}
function drawOncePerTurn(state, context, sequence) {
  const source = state.cardInstances[context.sourceInstanceId];
  if (!source || source.effectUsesThisTurn?.includes(context.effect.effectId)) return withEvent(state, context, sequence, "Movement draw was already used this turn.");
  const marked = { ...state, cardInstances: { ...state.cardInstances, [source.instanceId]: { ...source, effectUsesThisTurn: [...source.effectUsesThisTurn ?? [], context.effect.effectId] } } };
  return drawCards(marked, context, 1, sequence);
}
function creaturesInSelectedLane(state, context, relation) {
  const lane = selectedLane(context);
  return lane ? Object.values(state.cardInstances).filter((card) => card.zone === "board" && card.position && getLane(card.position.column) === lane && (relation === "ally" ? card.controllerSide === context.controllerSide : card.controllerSide !== context.controllerSide)) : [];
}
function laneCreaturesExceptSource(state, context) {
  const source = state.cardInstances[context.sourceInstanceId];
  if (!source?.position) return [];
  const lane = getLane(source.position.column);
  return Object.values(state.cardInstances).filter((card) => card.zone === "board" && card.position && card.instanceId !== source.instanceId && getLane(card.position.column) === lane);
}
function buffLaneAllies(state, context, bonus) {
  return buffCreatures(state, creaturesInSelectedLane(state, context, "ally"), bonus);
}
function moveSelected(state, context, cards, sequence) {
  const card = cards[0];
  const destination = selectedCoordinates(context)[0];
  if (!card?.position || !destination || !isNormalBoardCoordinate(destination) || getBoardSquare(state.board, destination)?.occupantId || getLane(card.position.column) !== getLane(destination.column)) return withEvent(state, context, sequence, "No legal movement destination was selected.");
  return { state: { ...state, board: setBoardOccupant(setBoardOccupant(state.board, card.position, void 0), destination, card.instanceId), cardInstances: { ...state.cardInstances, [card.instanceId]: { ...card, position: destination, movedThisTurn: true } } }, events: [event(context, sequence, "creature.moved", card.instanceId, "Card effect moved a creature.")] };
}
function returnSelected(state, context, cards, sequence) {
  let next = state;
  const events = [];
  for (const card of cards) {
    if (!card.position) continue;
    const player = next.players[card.ownerSide];
    next = { ...next, board: setBoardOccupant(next.board, card.position, void 0), players: { ...next.players, [card.ownerSide]: { ...player, handZone: [...player.handZone, card.instanceId] } }, cardInstances: { ...next.cardInstances, [card.instanceId]: { ...card, zone: "hand", position: void 0, boardEntrySequence: void 0, effectsDisabled: void 0, temporaryAttackBonus: void 0, temporaryHealthBonus: void 0 } } };
    events.push(event(context, sequence + events.length, "spell.resolved", card.instanceId, "Card effect returned a creature to hand."));
  }
  return events.length ? { state: next, events } : withEvent(state, context, sequence, "No selected creature could be returned.");
}
function returnGraveyardCards(state, context, sequence) {
  const ids = context.selection.kind === "structured" ? context.selection.value.graveyardCardIds ?? [] : [];
  const player = state.players[context.controllerSide];
  const valid = [...new Set(ids)].filter((id) => player.graveyardZone.includes(id) && isCreature2(state.cardInstances[id])).slice(0, 2);
  if (valid.length !== 2) return withEvent(state, context, sequence, "Two creature cards from graveyard are required.");
  return { state: { ...state, players: { ...state.players, [context.controllerSide]: { ...player, graveyardZone: player.graveyardZone.filter((id) => !valid.includes(id)), handZone: [...player.handZone, ...valid] } }, cardInstances: { ...state.cardInstances, ...Object.fromEntries(valid.map((id) => [id, { ...state.cardInstances[id], zone: "hand" }])) } }, events: valid.map((id, index) => event(context, sequence + index, "card.drawn", id, "Card effect returned a graveyard card to hand.")) };
}
function reviveSelected(state, context, sequence) {
  const id = context.selection.kind === "structured" ? context.selection.value.graveyardCardIds?.[0] : void 0;
  const destination = selectedCoordinates(context)[0];
  const card = id ? state.cardInstances[id] : void 0;
  const player = state.players[context.controllerSide];
  if (!card || !player.graveyardZone.includes(card.instanceId) || !isCreature2(card) || card.cost > 3 || !destination || !isNormalBoardCoordinate(destination) || getBoardSquare(state.board, destination)?.occupantId) return withEvent(state, context, sequence, "No legal revival was selected.");
  return { state: { ...state, board: setBoardOccupant(state.board, destination, card.instanceId), players: { ...state.players, [context.controllerSide]: { ...player, graveyardZone: player.graveyardZone.filter((candidate) => candidate !== card.instanceId) } }, cardInstances: { ...state.cardInstances, [card.instanceId]: { ...card, zone: "board", position: destination, currentHp: card.maxHp, summonedThisTurn: true, boardEntrySequence: sequence } } }, events: [event(context, sequence, "creature.summoned", card.instanceId, "Card effect revived a creature.")] };
}
function reviveSelectedPair(state, context, sequence) {
  const selection = context.selection.kind === "structured" ? context.selection.value : void 0;
  const ids = selection?.graveyardCardIds ?? [];
  const coordinates = selection?.coordinates ?? [];
  const player = state.players[context.controllerSide];
  if (new Set(ids).size !== 2 || new Set(coordinates.map((coordinate) => `${coordinate.column}:${coordinate.row}`)).size !== 2 || ids.length !== 2 || coordinates.length !== 2) {
    return withEvent(state, context, sequence, "Two distinct creature cards and two distinct destinations are required.");
  }
  const cards = ids.map((id) => state.cardInstances[id]);
  if (cards.some((card) => !card || !player.graveyardZone.includes(card.instanceId) || !isCreature2(card) || card.cost > 5) || coordinates.some((coordinate) => !isNormalBoardCoordinate(coordinate) || getBoardSquare(state.board, coordinate)?.occupantId)) {
    return withEvent(state, context, sequence, "No legal pair of revivals was selected.");
  }
  let next = state;
  const events = [];
  for (const [index, card] of cards.entries()) {
    const creature = card;
    const destination = coordinates[index];
    const currentPlayer = next.players[context.controllerSide];
    const revived = { ...creature, zone: "board", position: destination, currentHp: creature.maxHp, summonedThisTurn: true, movedThisTurn: false, boardEntrySequence: sequence + events.length, effectsDisabled: void 0, temporaryAttackBonus: void 0, temporaryHealthBonus: void 0 };
    next = { ...next, board: setBoardOccupant(next.board, destination, creature.instanceId), players: { ...next.players, [context.controllerSide]: { ...currentPlayer, graveyardZone: currentPlayer.graveyardZone.filter((id) => id !== creature.instanceId) } }, cardInstances: { ...next.cardInstances, [creature.instanceId]: revived } };
    events.push(event(context, sequence + events.length, "creature.summoned", creature.instanceId, "Card effect revived a creature."));
  }
  return { state: next, events };
}
function summonTokens(state, context, tokenCardId, coordinates, sequence) {
  let next = state;
  const events = [];
  for (const coordinate of coordinates) {
    if (!isNormalBoardCoordinate(coordinate) || getBoardSquare(next.board, coordinate)?.occupantId) continue;
    const id = `${tokenCardId}:${context.sourceInstanceId}:${sequence + events.length}`;
    const token = { instanceId: id, catalogCardId: tokenCardId, ownerSide: context.controllerSide, controllerSide: context.controllerSide, zone: "board", name: tokenCardId === "AK-T-001" ? "Luminous Wall" : "Shade Remnant", type: "creature-token", attribute: tokenCardId === "AK-T-001" ? "light" : "dark", cost: 1, currentCost: 1, attack: 1, currentAttack: 1, health: tokenCardId === "AK-T-001" ? 3 : 1, currentHp: tokenCardId === "AK-T-001" ? 3 : 1, maxHp: tokenCardId === "AK-T-001" ? 3 : 1, movement: 1, isToken: true, effectText: "", effectIds: [], position: coordinate, boardEntrySequence: sequence + events.length, summonedThisTurn: true, movedThisTurn: false };
    next = { ...next, board: setBoardOccupant(next.board, coordinate, id), cardInstances: { ...next.cardInstances, [id]: token } };
    events.push(event(context, sequence + events.length, "creature.summoned", id, "Card effect summoned a token."));
  }
  return events.length ? { state: next, events } : withEvent(state, context, sequence, "No token destination was legal.");
}
function summonTokensThenBuff(state, context, tokenCardId, coordinates, bonus, sequence) {
  const summoned = summonTokens(state, context, tokenCardId, coordinates, sequence);
  return { state: buffTokens(summoned.state, context, bonus), events: summoned.events };
}
function destroyLaneBlast(state, context, sequence) {
  const coordinate = selectedCoordinates(context)[0];
  if (!coordinate) return withEvent(state, context, sequence, "Destroyed creature location was unavailable.");
  return damageLaneEnemiesAndBases(state, context, getLane(coordinate.column), 2, sequence);
}
function summonAdjacentToken(state, context, tokenCardId, sequence) {
  const origin = selectedCoordinates(context)[0];
  const coordinate = origin ? getAdjacentBoardCoordinates(origin).filter((candidate) => isNormalBoardCoordinate(candidate) && !getBoardSquare(state.board, candidate)?.occupantId).sort((a, b) => a.column - b.column || a.row - b.row)[0] : void 0;
  return coordinate ? summonTokens(state, context, tokenCardId, [coordinate], sequence) : withEvent(state, context, sequence, "No adjacent token destination was legal.");
}
function reviveRandomAdjacent(state, context, sequence) {
  const origin = selectedCoordinates(context)[0];
  if (!origin) return withEvent(state, context, sequence, "Destroyed creature location was unavailable.");
  const player = state.players[context.controllerSide];
  const cards = player.graveyardZone.map((id) => state.cardInstances[id]).filter((candidate) => isCreature2(candidate) && candidate.cost <= 5).sort((a, b) => a.instanceId.localeCompare(b.instanceId));
  const destinations = getAdjacentBoardCoordinates(origin).filter((candidate) => isNormalBoardCoordinate(candidate) && !getBoardSquare(state.board, candidate)?.occupantId).sort((a, b) => a.column - b.column || a.row - b.row);
  if (cards.length === 0 || destinations.length === 0) return withEvent(state, context, sequence, "No eligible revival was available.");
  const [cardIndex, cardRng] = createRngFromState(state.metadata.rng).nextInt(cards.length);
  const [destinationIndex, rng] = cardRng.nextInt(destinations.length);
  const card = cards[cardIndex];
  const destination = destinations[destinationIndex];
  if (!card || !destination) return withEvent(state, context, sequence, "No eligible revival was available.");
  const revived = { ...card, zone: "board", position: destination, currentHp: card.maxHp, summonedThisTurn: true, movedThisTurn: false, boardEntrySequence: sequence };
  return { state: { ...state, metadata: { ...state.metadata, rng: rng.state }, board: setBoardOccupant(state.board, destination, card.instanceId), players: { ...state.players, [context.controllerSide]: { ...player, graveyardZone: player.graveyardZone.filter((id) => id !== card.instanceId) } }, cardInstances: { ...state.cardInstances, [card.instanceId]: revived } }, events: [event(context, sequence, "creature.summoned", card.instanceId, "Destroyed effect revived a creature.")] };
}
function buffTokens(state, context, bonus) {
  return buffCreatures(state, Object.values(state.cardInstances).filter((card) => card.zone === "board" && card.controllerSide === context.controllerSide && card.isToken), bonus);
}
function withEvent(state, context, sequence, message) {
  return { state, events: [event(context, sequence, "spell.resolved", context.sourceInstanceId, message)] };
}
function event(context, sequence, type, instanceId, message) {
  return { sequence, type, side: context.controllerSide, instanceId, message, data: { effectId: context.effect.effectId } };
}
function isCreature2(card) {
  return card.type === "creature" || card.type === "creature-token";
}

// packages/domain/src/battle/effectResolver.ts
function resolveEffect(context) {
  const source = context.state.cardInstances[context.sourceInstanceId];
  if (!source || source.controllerSide !== context.controllerSide) return rejected(context, "source-invalid");
  if (!isSelectionShapeValid(context.selection)) return rejected(context, "selection-invalid");
  context = { ...context, selection: normalizeSelection(context.selection) };
  let state = context.state;
  const events = [];
  let completedOperationCount = 0;
  let failedOperation;
  for (const [operationIndex, operation] of context.effect.operations.entries()) {
    const targets = resolveTargets(state, context, operation);
    if (targets.length < operation.minimumTargets) {
      failedOperation ??= { operationIndex, reason: "target-count" };
      if (operation.stopOnFailure) break;
      continue;
    }
    const applied = applyOperation(state, context, operation, targets, context.firstSequence + events.length);
    if (!applied) {
      failedOperation ??= { operationIndex, reason: "operation-invalid" };
      if (operation.stopOnFailure) break;
      continue;
    }
    state = applied.state;
    events.push(...applied.events);
    completedOperationCount += 1;
  }
  const status = completedOperationCount === 0 ? "fizzled" : "resolved";
  if (failedOperation) events.push({ sequence: context.firstSequence + events.length, type: "effect.partially-resolved", side: context.controllerSide, instanceId: context.sourceInstanceId, message: `Effect ${context.effect.effectId} partially resolved.`, data: { operationIndex: failedOperation.operationIndex, reason: failedOperation.reason } });
  if (status === "fizzled") events.push({ sequence: context.firstSequence + events.length, type: "effect.fizzled", side: context.controllerSide, instanceId: context.sourceInstanceId, message: `Effect ${context.effect.effectId} fizzled.` });
  return {
    accepted: true,
    state,
    events: events.map((event2) => withEffectSource(event2, context.sourceInstanceId)),
    effect: { status, completedOperationCount, ...failedOperation ? { failedOperation } : {}, consumed: status === "resolved" || context.effect.consumedOnFizzle }
  };
}
function withEffectSource(event2, sourceInstanceId) {
  if (event2.type === "resonance.effect-resolved") return event2;
  return { ...event2, data: { ...event2.data, effectSourceInstanceId: sourceInstanceId } };
}
function getLegalEffectTargets(state, controllerSide, operation) {
  const creatures = Object.values(state.cardInstances).filter((card) => card.zone === "board" && matchesCreatureRule(card, controllerSide, operation.target)).map((card) => ({ kind: "creature", instanceId: card.instanceId }));
  const bases = supportsBaseTargets(operation.target) ? Object.values(state.bases).filter((base) => isBaseTargetValid(base, controllerSide, operation.target)).map((base) => ({ kind: "base", baseId: base.id })) : [];
  return [...creatures, ...bases].sort(compareTarget);
}
function resolveTargets(state, context, operation) {
  const selected = [...selectionTargets(context.selection)].sort(compareTarget);
  if (selected.length > operation.maximumTargets) return [];
  return selected.filter((target) => isTargetValid(state, context.controllerSide, operation.target, target));
}
function applyOperation(state, context, operation, targets, sequence) {
  if (operation.kind === "card-script") {
    return operation.cardId ? resolveCardEffectScript(state, context, operation.cardId, sequence) : void 0;
  }
  if (operation.kind === "emit") return operation.eventType && operation.message ? { state, events: [{ sequence, type: operation.eventType, side: context.controllerSide, instanceId: context.sourceInstanceId, message: operation.message }] } : void 0;
  if (!Number.isInteger(operation.amount) || operation.amount === void 0 || operation.amount <= 0) return void 0;
  if (operation.kind === "damage") return applyHealthDelta(state, context, targets, -operation.amount, sequence, "damaged");
  return applyHealthDelta(state, context, targets, operation.amount, sequence, "healed");
}
function applyHealthDelta(state, context, targets, delta, firstSequence, verb) {
  let next = state;
  const events = [];
  for (const target of targets) {
    if (target.kind === "creature") {
      const card = next.cardInstances[target.instanceId];
      const currentHp = Math.max(0, Math.min(card.maxHp ?? card.currentHp ?? 0, (card.currentHp ?? 0) + delta));
      next = { ...next, cardInstances: { ...next.cardInstances, [card.instanceId]: { ...card, currentHp } } };
      events.push({ sequence: firstSequence + events.length, type: "creature.damaged", side: context.controllerSide, instanceId: card.instanceId, message: `${card.name} was ${verb}.`, data: { amount: Math.abs(delta), effectId: context.effect.effectId } });
      if (delta < 0 && currentHp === 0) {
        const destroyed = destroyCreature(next, card.instanceId, firstSequence + events.length);
        next = destroyed.state;
        events.push(...destroyed.events);
      }
    } else {
      const base = getBattleBaseById(next.bases, target.baseId);
      const currentHp = Math.max(0, Math.min(base.maxHp, base.currentHp + delta));
      next = { ...next, bases: { ...next.bases, [base.id]: { ...base, currentHp } } };
      events.push({ sequence: firstSequence + events.length, type: "base.damaged", side: context.controllerSide, message: `Base ${base.id} was ${verb}.`, data: { amount: Math.abs(delta), effectId: context.effect.effectId } });
    }
  }
  return { state: next, events };
}
function isTargetValid(state, controllerSide, rule, target) {
  if (target.kind === "base") return isBaseTargetValid(getBattleBaseById(state.bases, target.baseId), controllerSide, rule);
  const card = state.cardInstances[target.instanceId];
  return Boolean(card && card.zone === "board" && matchesCreatureRule(card, controllerSide, rule));
}
function matchesCreatureRule(card, side, rule) {
  return rule === "any-creature" || (rule === "ally-creature" || rule === "ally-creature-or-own-base") && card.controllerSide === side || (rule === "enemy-creature" || rule === "enemy-creature-or-attackable-base") && card.controllerSide !== side;
}
function supportsBaseTargets(rule) {
  return rule === "attackable-base" || rule === "enemy-creature-or-attackable-base" || rule === "ally-creature-or-own-base";
}
function isBaseTargetValid(base, side, rule) {
  return base.currentHp > 0 && (rule === "attackable-base" || rule === "enemy-creature-or-attackable-base" ? base.owner !== side : rule === "ally-creature-or-own-base" && base.owner === side);
}
function selectionTargets(selection) {
  if (selection.kind === "creatures") return unique(selection.instanceIds).map((instanceId) => ({ kind: "creature", instanceId }));
  if (selection.kind === "base") return [{ kind: "base", baseId: selection.baseId }];
  if (selection.kind !== "structured") return [];
  return [
    ...unique(selection.value.creatureIds ?? []).map((instanceId) => ({ kind: "creature", instanceId })),
    ...unique(selection.value.baseIds ?? []).map((baseId) => ({ kind: "base", baseId }))
  ];
}
function unique(values) {
  return [...new Set(values)].sort();
}
function compareTarget(left, right) {
  const leftKey = left.kind === "creature" ? `0:${left.instanceId}` : `1:${left.baseId}`;
  const rightKey = right.kind === "creature" ? `0:${right.instanceId}` : `1:${right.baseId}`;
  return leftKey.localeCompare(rightKey);
}
function isSelectionShapeValid(selection) {
  if (selection.kind === "creatures") return selection.instanceIds.every(isNonEmptyString);
  if (selection.kind === "base") return isNonEmptyString(selection.baseId);
  if (selection.kind !== "structured") return true;
  const value = selection.value;
  return (value.creatureIds?.every(isNonEmptyString) ?? true) && (value.baseIds?.every(isNonEmptyString) ?? true) && (value.graveyardCardIds?.every(isNonEmptyString) ?? true) && (value.coordinates?.every(isNormalBoardCoordinate) ?? true) && (value.lane === void 0 || value.lane === "left" || value.lane === "center" || value.lane === "right");
}
function normalizeSelection(selection) {
  if (selection.kind === "creatures") return { kind: "creatures", instanceIds: unique(selection.instanceIds) };
  if (selection.kind !== "structured") return selection;
  const value = selection.value;
  const coordinates = value.coordinates ? [...new Map(value.coordinates.map((coordinate) => [`${coordinate.column}:${coordinate.row}`, coordinate])).values()].sort((left, right) => left.column - right.column || left.row - right.row) : void 0;
  return { kind: "structured", value: {
    ...value,
    ...value.creatureIds ? { creatureIds: unique(value.creatureIds) } : {},
    ...value.baseIds ? { baseIds: unique(value.baseIds) } : {},
    ...value.graveyardCardIds ? { graveyardCardIds: unique(value.graveyardCardIds) } : {},
    ...coordinates ? { coordinates } : {}
  } };
}
function isNonEmptyString(value) {
  return typeof value === "string" && value.length > 0;
}
function rejected(context, rejection) {
  return { accepted: false, state: context.state, events: [], rejection };
}

// packages/domain/src/battle/validation.ts
function validateBattleCommand(state, command) {
  if (command.type === "resign") {
    return validateResignation(state);
  }
  const commonIssues = validateCommon(state, command);
  if (commonIssues.length > 0) {
    return commonIssues;
  }
  switch (command.type) {
    case "summonCreature":
      return validateSummon(state, command);
    case "castSpell":
      return validateSpell(state, command);
    case "moveCreature":
      return validateMove(state, command);
    case "endPlayPhase":
      return [];
  }
}
function validateResignation(state) {
  if (state.phase === "terminal" || state.terminalResult) {
    return [
      {
        code: "battle.terminal",
        message: "The battle has already ended."
      }
    ];
  }
  return [];
}
function getFirstValidationMessage(issues) {
  return issues[0]?.message ?? "Command is not legal.";
}
function validateCommon(state, command) {
  if (state.phase === "terminal" || state.terminalResult) {
    return [
      {
        code: "battle.terminal",
        message: "The battle has already ended."
      }
    ];
  }
  if (state.phase !== "play") {
    return [
      {
        code: "battle.phase.invalid",
        message: "Battle commands can be confirmed only during a play phase."
      }
    ];
  }
  if (state.activeSide !== command.side) {
    return [
      {
        code: "battle.side.inactive",
        message: "It is not this side's turn."
      }
    ];
  }
  return [];
}
function validateSummon(state, command) {
  const sourceIssues = validateSummonSource(state, command.side, command.handInstanceId);
  if (sourceIssues.length > 0) {
    return sourceIssues;
  }
  const destinationIssues = validateSummonDestination(state, command.side, command.destination);
  if (destinationIssues.length > 0) return destinationIssues;
  const card = state.cardInstances[command.handInstanceId];
  const cost = getCreaturePlayCost(state, command.side, card, getLane(command.destination.column));
  if (cost > state.players[command.side].currentPp) return [{
    code: "battle.resource.pp-insufficient",
    message: "Not enough PP to play this creature.",
    path: "currentPp"
  }];
  if (requiresSummonEffectSelection(card) && !command.effectSelection) return [];
  const counts = { "AK-038": 1, "AK-042": 1, "AK-046": 2, "AK-048": 3, "AK-057": 1 };
  const count = counts[card.catalogCardId];
  if (count) {
    const selection = command.effectSelection;
    const coordinates = selection?.coordinates ?? [];
    const validCell = (coordinate) => {
      const square = state.board.squares.find((candidate) => candidate.coordinate.column === coordinate.column && candidate.coordinate.row === coordinate.row);
      if (!square || square.terrain !== "normal" || square.occupantId || coordinate.column === command.destination.column && coordinate.row === command.destination.row) return false;
      return card.catalogCardId === "AK-038" || card.catalogCardId === "AK-057" ? Math.abs(coordinate.column - command.destination.column) <= 1 && Math.abs(coordinate.row - command.destination.row) <= 1 : square.lane === getLane(command.destination.column);
    };
    const graveyardTarget = selection?.graveyardCardIds?.[0];
    const graveyardCard = graveyardTarget ? state.cardInstances[graveyardTarget] : void 0;
    const graveyardOk = card.catalogCardId !== "AK-057" || Boolean(selection?.graveyardCardIds?.length === 1 && graveyardTarget && state.players[command.side].graveyardZone.includes(graveyardTarget) && graveyardCard && (graveyardCard.type === "creature" || graveyardCard.type === "creature-token") && graveyardCard.cost <= 3);
    if (!(coordinates.length === count && new Set(coordinates.map((coordinate) => `${coordinate.column}:${coordinate.row}`)).size === count && coordinates.every(validCell) && graveyardOk)) {
      return invalidSelection("Select the required legal effect targets before summoning.");
    }
  }
  return validateSummonEffectSelection(state, command.side, card, command.effectSelection, command.destination) ?? [];
}
function requiresSummonEffectSelection(card) {
  const operation = getExecutablePlayEffects(card)[0]?.operations[0];
  if (operation && operation.minimumTargets > 0) return true;
  return hasTargetedSummonEffect(card);
}
function validateSpell(state, command) {
  const card = state.cardInstances[command.handInstanceId];
  const issues = validateHandCard(state, command.side, card, "spell");
  if (issues.length > 0) {
    return issues;
  }
  const player = state.players[command.side];
  if (card.currentCost > player.currentPp) {
    return [
      {
        code: "battle.resource.pp-insufficient",
        message: "Not enough PP to cast this spell.",
        path: "currentPp"
      }
    ];
  }
  const effect = getExecutablePlayEffects(card)[0];
  if (!effect) return [];
  const operation = effect.operations[0];
  if (operation?.kind === "card-script") {
    if (!isCardEffectScriptSupported(card.catalogCardId)) {
      return [{ code: "battle.effect.unsupported", message: "This card effect has no executable program.", path: "effectSelection" }];
    }
    return validateScriptedSpellSelection(state, command, card);
  }
  const structuredTargets = command.effectSelection ? [
    ...(command.effectSelection.creatureIds ?? []).map((instanceId) => ({ kind: "creature", instanceId })),
    ...(command.effectSelection.baseIds ?? []).map((baseId) => ({ kind: "base", baseId }))
  ] : [];
  const selected = command.effectSelection ? structuredTargets.length === 1 ? structuredTargets[0] : void 0 : command.targetInstanceId ? { kind: "creature", instanceId: command.targetInstanceId } : command.targetBaseId ? { kind: "base", baseId: command.targetBaseId } : void 0;
  if (!selected) return [{ code: "battle.effect.no-target", message: "This spell requires a legal target.", path: "target" }];
  const legal = operation ? getLegalEffectTargets(state, command.side, operation) : [];
  const isLegal = legal.some((target) => {
    if (target.kind !== selected.kind) return false;
    return target.kind === "creature" && selected.kind === "creature" ? target.instanceId === selected.instanceId : target.kind === "base" && selected.kind === "base" ? target.baseId === selected.baseId : false;
  });
  return isLegal ? [] : [{ code: "battle.effect.no-target", message: "The selected spell target is no longer legal.", path: "target" }];
}
function validateScriptedSpellSelection(state, command, card) {
  const selection = command.effectSelection;
  const ids = selection?.graveyardCardIds ?? [];
  const coordinates = selection?.coordinates ?? [];
  const player = state.players[command.side];
  const uniqueCoordinates = new Set(coordinates.map((coordinate) => `${coordinate.column}:${coordinate.row}`));
  const emptyNormal = (coordinate) => state.board.squares.some((square) => square.coordinate.column === coordinate.column && square.coordinate.row === coordinate.row && square.terrain === "normal" && !square.occupantId);
  if (card.catalogCardId === "AK-008" || card.catalogCardId === "AK-011") return selection?.lane ? [] : invalidSelection("Select one lane.");
  if (card.catalogCardId === "AK-019") {
    const creature = selection?.creatureIds?.[0];
    const source = creature ? state.cardInstances[creature] : void 0;
    return source?.position && coordinates.length === 1 && emptyNormal(coordinates[0]) && getLane(source.position.column) === getLane(coordinates[0].column) ? [] : invalidSelection("Select a creature and an empty cell in its lane.");
  }
  if (card.catalogCardId === "AK-044") {
    const lane = selection?.lane;
    return lane && coordinates.length === 3 && uniqueCoordinates.size === 3 && coordinates.every((coordinate) => emptyNormal(coordinate) && getLane(coordinate.column) === lane) ? [] : invalidSelection("Select one lane and three empty cells in that lane.");
  }
  if (card.catalogCardId === "AK-054") {
    return ids.length === 2 && new Set(ids).size === 2 && ids.every((id) => {
      const target = state.cardInstances[id];
      return Boolean(target && player.graveyardZone.includes(id) && (target.type === "creature" || target.type === "creature-token"));
    }) ? [] : invalidSelection("Select two creature cards from your graveyard.");
  }
  if (card.catalogCardId !== "AK-059") return validateSummonEffectSelection(state, command.side, card, selection) ?? [];
  const valid = ids.length === 2 && new Set(ids).size === 2 && coordinates.length === 2 && uniqueCoordinates.size === 2 && ids.every((id) => {
    const target = state.cardInstances[id];
    return Boolean(target && player.graveyardZone.includes(id) && (target.type === "creature" || target.type === "creature-token") && target.cost <= 5);
  }) && coordinates.every((coordinate) => validateSummonDestination(state, command.side, coordinate).length === 0);
  return valid ? [] : invalidSelection("Resurrection Gate requires two eligible graveyard creatures and two empty summon squares.");
}
function validateSummonEffectSelection(state, side, card, selection, summonDestination) {
  const operation = getExecutablePlayEffects(card)[0]?.operations[0];
  if (operation && operation.kind !== "card-script") {
    const creatureIds = selection?.creatureIds ?? [];
    const baseIds = selection?.baseIds ?? [];
    const selected = [...creatureIds.map((instanceId) => ({ kind: "creature", instanceId })), ...baseIds.map((baseId) => ({ kind: "base", baseId }))];
    const legal = getLegalEffectTargets(state, side, operation);
    const valid = selected.length >= operation.minimumTargets && selected.length <= operation.maximumTargets && selected.every((target2) => legal.some((candidate) => candidate.kind === target2.kind && (target2.kind === "creature" ? candidate.kind === "creature" && candidate.instanceId === target2.instanceId : candidate.kind === "base" && candidate.baseId === target2.baseId)));
    return valid ? [] : invalidSelection("Select the required legal effect target.");
  }
  const relation = ["AK-006", "AK-018", "AK-052", "AK-015", "AK-039", "AK-050"].includes(card.catalogCardId) ? "ally" : ["AK-020", "AK-041", "AK-055"].includes(card.catalogCardId) ? "enemy" : void 0;
  if (!relation) return void 0;
  const selectedId = selection?.creatureIds?.[0];
  const target = selectedId ? state.cardInstances[selectedId] : void 0;
  const validCreature = Boolean(
    selectedId && selection?.creatureIds?.length === 1 && target?.zone === "board" && (relation === "ally" ? target.controllerSide === side : target.controllerSide !== side) && (!["AK-006", "AK-018", "AK-052"].includes(card.catalogCardId) || target.instanceId !== card.instanceId) && (card.catalogCardId !== "AK-020" || Boolean(summonDestination && target.position && getLane(target.position.column) === getLane(summonDestination.column)))
  );
  if (!validCreature) return invalidSelection("Select the required legal effect target.");
  if (card.catalogCardId !== "AK-018") return [];
  const coordinate = selection?.coordinates?.[0];
  const square = coordinate && state.board.squares.find((candidate) => candidate.coordinate.column === coordinate.column && candidate.coordinate.row === coordinate.row);
  const validDestination = Boolean(coordinate && selection?.coordinates?.length === 1 && square?.terrain === "normal" && !square.occupantId && target?.position && Math.abs(coordinate.column - target.position.column) <= 1 && Math.abs(coordinate.row - target.position.row) <= 1 && !(coordinate.column === target.position.column && coordinate.row === target.position.row) && !(summonDestination && coordinate.column === summonDestination.column && coordinate.row === summonDestination.row));
  return validDestination ? [] : invalidSelection("Select an empty square adjacent to the selected creature.");
}
function invalidSelection(message) {
  return [{ code: "battle.effect.no-target", message, path: "effectSelection" }];
}
function validateMove(state, command) {
  return validateMovementPath(
    state,
    command.side,
    command.creatureInstanceId,
    command.origin,
    command.path
  );
}
function validateHandCard(state, side, card, requiredType) {
  if (!card) {
    return [
      {
        code: "battle.card.not-found",
        message: "The selected card no longer exists.",
        path: "handInstanceId"
      }
    ];
  }
  if (card.ownerSide !== side || !state.players[side].handZone.includes(card.instanceId)) {
    return [
      {
        code: "battle.card.owner-invalid",
        message: "The selected card is not in this side's hand.",
        path: "handInstanceId"
      }
    ];
  }
  if (card.zone !== "hand") {
    return [
      {
        code: "battle.card.zone-invalid",
        message: "The selected card is not in hand.",
        path: "handInstanceId"
      }
    ];
  }
  if (card.type !== requiredType) {
    return [
      {
        code: "battle.card.type-invalid",
        message: requiredType === "creature" ? "Only creature cards can be summoned." : "Only spell cards can be cast.",
        path: "handInstanceId"
      }
    ];
  }
  return [];
}

// packages/domain/src/battle/legalActions.ts
function generateLegalActions(state, side) {
  if (state.phase !== "play" || state.activeSide !== side || state.terminalResult) {
    return [];
  }
  const actions = [];
  const player = state.players[side];
  for (const instanceId of player.handZone) {
    const card = state.cardInstances[instanceId];
    if (!card) {
      continue;
    }
    if (card.type === "creature" || card.type === "creature-token") {
      for (const destination of getSummonDestinations(state, side, instanceId)) {
        const selection = summonEffectSelection(state, side, card, destination);
        const command = {
          type: "summonCreature",
          side,
          handInstanceId: instanceId,
          destination,
          ...selection ? { effectSelection: selection } : {}
        };
        if (validateBattleCommand(state, command).length === 0) {
          actions.push({
            command,
            label: `Summon ${card.name}`,
            scoreHint: card.currentAttack ?? 1
          });
        }
      }
    } else if (card.type === "spell") {
      actions.push(...spellActions(state, side, card));
    }
  }
  for (const card of Object.values(state.cardInstances)) {
    if (card.zone !== "board" || card.controllerSide !== side || !card.position) {
      continue;
    }
    for (const path of getShortestMovementPaths(state, side, card.instanceId)) {
      const command = {
        type: "moveCreature",
        side,
        creatureInstanceId: card.instanceId,
        origin: card.position,
        path
      };
      if (validateBattleCommand(state, command).length === 0) {
        actions.push({
          command,
          label: `Move ${card.name}`,
          scoreHint: 1
        });
      }
    }
  }
  actions.push({
    command: {
      type: "endPlayPhase",
      side,
      reason: side === "cpu" ? "cpu" : "manual"
    },
    label: "End play phase",
    scoreHint: 0
  });
  return actions;
}
function summonEffectSelection(state, side, card, destination) {
  const count = { "AK-038": 1, "AK-042": 1, "AK-046": 2, "AK-048": 3, "AK-057": 1 };
  const needed = count[card.catalogCardId];
  if (needed) {
    const cells = state.board.squares.filter((square) => square.terrain === "normal" && !square.occupantId && !(square.coordinate.column === destination.column && square.coordinate.row === destination.row) && (["AK-038", "AK-057"].includes(card.catalogCardId) ? Math.abs(square.coordinate.column - destination.column) <= 1 && Math.abs(square.coordinate.row - destination.row) <= 1 : square.lane === getLane(destination.column))).slice(0, needed).map((square) => square.coordinate);
    if (cells.length !== needed) return void 0;
    if (card.catalogCardId !== "AK-057") return { coordinates: cells };
    const grave = state.players[side].graveyardZone.find((id) => {
      const target = state.cardInstances[id];
      return Boolean(target && (target.type === "creature" || target.type === "creature-token") && target.cost <= 3);
    });
    return grave ? { coordinates: cells, graveyardCardIds: [grave] } : void 0;
  }
  const choice = getEffectChoiceForCard(state, side, card, destination);
  if (!choice) return void 0;
  const firstCreature = choice.candidates.find((candidate) => candidate.kind === "creature");
  const firstBase = choice.candidates.find((candidate) => candidate.kind === "base");
  if (card.catalogCardId === "AK-018" && firstCreature) {
    const target = state.cardInstances[firstCreature.id];
    const coordinate = target?.position && choice.candidates.find((candidate) => {
      if (candidate.kind !== "coordinate") return false;
      const [column2, row2] = candidate.id.split(":").map(Number);
      return Math.abs(column2 - target.position.column) <= 1 && Math.abs(row2 - target.position.row) <= 1 && !(column2 === target.position.column && row2 === target.position.row);
    });
    if (!coordinate) return void 0;
    const [column, row] = coordinate.id.split(":").map(Number);
    return { creatureIds: [firstCreature.id], coordinates: [{ column, row }] };
  }
  if (firstCreature) return { creatureIds: [firstCreature.id] };
  if (firstBase) return { baseIds: [firstBase.id] };
  return void 0;
}
function getPublicEffectChoices(state, side) {
  if (state.phase !== "play" || state.activeSide !== side || state.terminalResult) return [];
  return state.players[side].handZone.flatMap((instanceId) => {
    const card = state.cardInstances[instanceId];
    if (!card || card.type !== "spell") return [];
    const choice = getEffectChoiceForCard(state, side, card);
    return choice ? [choice] : [];
  });
}
function getEffectChoiceForCard(state, side, card, summonDestination) {
  const scripted = scriptedChoice(state, side, card, summonDestination);
  if (scripted) return scripted;
  return getExecutablePlayEffects(card).flatMap((effect) => {
    const operation = effect.operations[0];
    if (!operation || operation.kind === "card-script") return [];
    const candidates = getLegalEffectTargets(state, side, operation).map((target) => target.kind === "creature" ? { kind: "creature", id: target.instanceId, label: state.cardInstances[target.instanceId]?.name ?? target.instanceId } : { kind: "base", id: target.baseId, label: target.baseId });
    return [{ effectId: effect.effectId, sourceInstanceId: card.instanceId, selectionKinds: [...new Set(candidates.map((candidate) => candidate.kind))], candidates, minimumTargets: operation.minimumTargets, maximumTargets: operation.maximumTargets }];
  })[0];
}
function scriptedChoice(state, side, card, summonDestination) {
  const summonStructured = summonStructuredChoice(state, side, card, summonDestination);
  if (summonStructured) return summonStructured;
  const creatureTarget = scriptedCreatureTargetChoice(state, side, card, summonDestination);
  if (creatureTarget) return creatureTarget;
  const config = {
    "AK-008": { kinds: ["lane"], min: 1, max: 1 },
    "AK-011": { kinds: ["lane"], min: 1, max: 1 },
    "AK-019": { kinds: ["coordinate"], min: 2, max: 2 },
    "AK-044": { kinds: ["lane", "coordinate"], min: 4, max: 4 },
    "AK-054": { kinds: ["graveyard"], min: 2, max: 2 },
    "AK-059": { kinds: ["graveyard", "coordinate"], min: 4, max: 4 }
  };
  const rule = config[card.catalogCardId];
  if (!rule) return void 0;
  const candidates = structuredCandidates(state, side, card);
  return { effectId: card.effectIds[0] ?? card.catalogCardId, sourceInstanceId: card.instanceId, selectionKinds: [...new Set(candidates.map((candidate) => candidate.kind))], candidates, minimumTargets: rule.min, maximumTargets: rule.max };
}
function summonStructuredChoice(state, side, card, summonDestination) {
  const counts = { "AK-038": 1, "AK-042": 1, "AK-046": 2, "AK-048": 3, "AK-057": 1 };
  const count = counts[card.catalogCardId];
  if (!count || !summonDestination) return void 0;
  const coordinates = state.board.squares.filter((square) => square.terrain === "normal" && !square.occupantId && !(square.coordinate.column === summonDestination.column && square.coordinate.row === summonDestination.row)).filter((square) => ["AK-038", "AK-057"].includes(card.catalogCardId) ? Math.abs(square.coordinate.column - summonDestination.column) <= 1 && Math.abs(square.coordinate.row - summonDestination.row) <= 1 : square.lane === getLane(summonDestination.column)).map((square) => ({ kind: "coordinate", id: `${square.coordinate.column}:${square.coordinate.row}`, label: `Cell ${square.coordinate.column},${square.coordinate.row}` }));
  const graveyard = card.catalogCardId === "AK-057" ? state.players[side].graveyardZone.flatMap((id, index) => {
    const target = state.cardInstances[id];
    return target && (target.type === "creature" || target.type === "creature-token") && target.cost <= 3 ? [{ kind: "graveyard", id, label: `Graveyard card ${index + 1}` }] : [];
  }) : [];
  return {
    effectId: card.effectIds[0] ?? card.catalogCardId,
    sourceInstanceId: card.instanceId,
    selectionKinds: [...new Set([...graveyard, ...coordinates].map((candidate) => candidate.kind))],
    candidates: [...graveyard, ...coordinates],
    minimumTargets: count + (card.catalogCardId === "AK-057" ? 1 : 0),
    maximumTargets: count + (card.catalogCardId === "AK-057" ? 1 : 0)
  };
}
function scriptedCreatureTargetChoice(state, side, card, summonDestination) {
  const relation = ["AK-006", "AK-018", "AK-052", "AK-015", "AK-039", "AK-050"].includes(card.catalogCardId) ? "ally" : ["AK-020", "AK-041", "AK-055"].includes(card.catalogCardId) ? "enemy" : void 0;
  if (!relation) return void 0;
  const creatures = Object.values(state.cardInstances).filter((candidate) => candidate.zone === "board" && (relation === "ally" ? candidate.controllerSide === side : candidate.controllerSide !== side)).filter((candidate) => !["AK-006", "AK-018", "AK-052"].includes(card.catalogCardId) || candidate.instanceId !== card.instanceId).filter((candidate) => card.catalogCardId !== "AK-020" || Boolean(summonDestination && candidate.position && getLane(candidate.position.column) === getLane(summonDestination.column))).map((candidate) => ({ kind: "creature", id: candidate.instanceId, label: candidate.name }));
  const coordinates = card.catalogCardId === "AK-018" ? state.board.squares.filter((square) => square.terrain === "normal" && !square.occupantId && !(summonDestination && square.coordinate.column === summonDestination.column && square.coordinate.row === summonDestination.row)).map((square) => ({ kind: "coordinate", id: `${square.coordinate.column}:${square.coordinate.row}`, label: `Cell ${square.coordinate.column},${square.coordinate.row}` })) : [];
  const candidates = [...creatures, ...coordinates];
  const targets = card.catalogCardId === "AK-018" ? 2 : 1;
  return {
    effectId: card.effectIds[0] ?? card.catalogCardId,
    sourceInstanceId: card.instanceId,
    selectionKinds: [...new Set(candidates.map((candidate) => candidate.kind))],
    candidates,
    minimumTargets: targets,
    maximumTargets: targets
  };
}
function structuredCandidates(state, side, card) {
  const emptyNormal = state.board.squares.filter((square) => square.terrain === "normal" && !square.occupantId);
  const coordinate = (square) => ({ kind: "coordinate", id: `${square.coordinate.column}:${square.coordinate.row}`, label: `Cell ${square.coordinate.column},${square.coordinate.row}` });
  if (card.catalogCardId === "AK-019") {
    const viable = Object.values(state.cardInstances).filter((candidate) => candidate.zone === "board" && candidate.position && emptyNormal.some((square) => square.lane === getLane(candidate.position.column)));
    const lanes = new Set(viable.map((candidate) => getLane(candidate.position.column)));
    return [
      ...viable.map((candidate, index) => ({ kind: "creature", id: candidate.instanceId, label: candidate.controllerSide === side ? candidate.name : `Opponent creature ${index + 1}` })),
      ...emptyNormal.filter((square) => lanes.has(square.lane)).map(coordinate)
    ];
  }
  if (card.catalogCardId === "AK-044") {
    const lanes = ["left", "center", "right"].filter((lane) => emptyNormal.filter((square) => square.lane === lane).length >= 3);
    return [...lanes.map((id) => ({ kind: "lane", id, label: `${id} lane` })), ...emptyNormal.filter((square) => lanes.includes(square.lane)).map(coordinate)];
  }
  if (card.catalogCardId === "AK-054" || card.catalogCardId === "AK-059") {
    const eligibleGraveyard = state.players[side].graveyardZone.filter((id) => {
      const target = state.cardInstances[id];
      return Boolean(target && (target.type === "creature" || target.type === "creature-token") && (card.catalogCardId !== "AK-059" || target.cost <= 5));
    });
    const graves = eligibleGraveyard.map((id, index) => ({ kind: "graveyard", id, label: `Graveyard card ${index + 1}` }));
    if (card.catalogCardId === "AK-054") return graves;
    const summonSquares = getSummonRangeCoordinates(state, side).filter((cell) => !state.board.squares.find((square) => square.coordinate.column === cell.column && square.coordinate.row === cell.row)?.occupantId).map((cell) => ({ kind: "coordinate", id: `${cell.column}:${cell.row}`, label: `Cell ${cell.column},${cell.row}` }));
    return eligibleGraveyard.length >= 2 && summonSquares.length >= 2 ? [...graves, ...summonSquares] : [];
  }
  if (card.catalogCardId === "AK-008" || card.catalogCardId === "AK-011") return ["left", "center", "right"].map((id) => ({ kind: "lane", id, label: `${id} lane` }));
  return [];
}
function spellActions(state, side, card) {
  const choices = getPublicEffectChoices(state, side).filter((choice) => choice.sourceInstanceId === card.instanceId);
  if (choices.length === 0) return legalSpellAction(state, { type: "castSpell", side, handInstanceId: card.instanceId }, card);
  const structured = choices[0];
  if (structured && structured.candidates.some((candidate) => candidate.kind === "lane" || candidate.kind === "coordinate" || candidate.kind === "graveyard")) {
    if (card.catalogCardId === "AK-008" || card.catalogCardId === "AK-011") {
      return structured.candidates.filter((candidate) => candidate.kind === "lane").flatMap((candidate) => legalSpellAction(state, {
        type: "castSpell",
        side,
        handInstanceId: card.instanceId,
        effectSelection: { lane: candidate.id }
      }, card));
    }
    const take = (kind, count) => structured.candidates.filter((candidate) => candidate.kind === kind).slice(0, count).map((candidate) => candidate.id);
    const lane = take("lane", 1)[0];
    const creatures = take("creature", 1);
    const graves = take("graveyard", card.catalogCardId === "AK-054" || card.catalogCardId === "AK-059" ? 2 : 0);
    const coordinateCandidates = structured.candidates.filter((candidate) => candidate.kind === "coordinate");
    const selectedCreature = creatures[0] ? state.cardInstances[creatures[0]] : void 0;
    const compatible = card.catalogCardId === "AK-019" && selectedCreature?.position ? coordinateCandidates.filter((candidate) => getLane(Number(candidate.id.split(":")[0])) === getLane(selectedCreature.position.column)) : coordinateCandidates.filter((candidate) => !lane || getLane(Number(candidate.id.split(":")[0])) === lane);
    const coordinates = compatible.slice(0, card.catalogCardId === "AK-044" ? 3 : card.catalogCardId === "AK-059" ? 2 : 1).map((candidate) => {
      const [column, row] = candidate.id.split(":").map(Number);
      return { column, row };
    });
    return legalSpellAction(state, { type: "castSpell", side, handInstanceId: card.instanceId, effectSelection: { ...lane ? { lane } : {}, ...creatures.length ? { creatureIds: creatures } : {}, ...graves.length ? { graveyardCardIds: graves } : {}, ...coordinates.length ? { coordinates } : {} } }, card);
  }
  return choices.flatMap((choice) => choice.candidates.flatMap((candidate) => legalSpellAction(state, {
    type: "castSpell",
    side,
    handInstanceId: card.instanceId,
    ...candidate.kind === "creature" ? { targetInstanceId: candidate.id } : { targetBaseId: candidate.id }
  }, card)));
}
function legalSpellAction(state, command, card) {
  return validateBattleCommand(state, command).length === 0 ? [{ command, label: `Cast ${card.name}`, scoreHint: Math.max(1, card.currentCost) }] : [];
}

// packages/domain/src/battle/effects.ts
function resolveSimpleSpellEffect(state, spell, side, firstSequence) {
  const events = [
    {
      sequence: firstSequence,
      type: "spell.resolved",
      side,
      instanceId: spell.instanceId,
      message: `${labelSide5(side)} cast ${spell.name}.`,
      data: { effectSourceInstanceId: spell.instanceId }
    },
    {
      sequence: firstSequence + 1,
      type: "effect.fizzled",
      side,
      instanceId: spell.instanceId,
      message: `${spell.name}'s card-specific effect is not implemented yet.`,
      data: {
        reason: "effect-deferred",
        effectSourceInstanceId: spell.instanceId
      }
    }
  ];
  return {
    state,
    events
  };
}
function labelSide5(side) {
  return side === "player" ? "Player" : "CPU";
}

// packages/domain/src/battle/effectTypes.ts
function toEffectSelection(value, targetInstanceId, targetBaseId) {
  if (value) return { kind: "structured", value };
  if (targetInstanceId) return { kind: "creatures", instanceIds: [targetInstanceId] };
  if (targetBaseId) return { kind: "base", baseId: targetBaseId };
  return { kind: "none" };
}

// packages/domain/src/battle/effectSupport.ts
function getEffectiveModifiedValue(baseValue, modifiers, attribute, targetInstanceId, turnNumber) {
  return modifiers.filter((modifier) => modifier.targetInstanceId === targetInstanceId && modifier.attribute === attribute && !modifier.invalidated && (modifier.expiresAtTurn === void 0 || modifier.expiresAtTurn >= turnNumber)).sort((left, right) => left.startedSequence - right.startedSequence || left.id.localeCompare(right.id)).reduce((value, modifier) => modifier.operator === "set" ? modifier.value : value + modifier.value, baseValue);
}
function expireModifiers(modifiers, turnNumber) {
  return modifiers.filter((modifier) => modifier.expiresAtTurn === void 0 || modifier.expiresAtTurn >= turnNumber);
}
function drainTriggers(initial, handler, maxDepth = 64) {
  const queue = [...initial].sort(compareTrigger);
  const visited = /* @__PURE__ */ new Set();
  const values = [];
  while (queue.length > 0) {
    const trigger = queue.shift();
    const key = `${trigger.eventSequence}:${trigger.sourceInstanceId}:${trigger.effectId}`;
    if (trigger.depth > maxDepth || visited.has(key)) return { ok: false, values, rejection: "trigger-loop" };
    visited.add(key);
    const result = handler(trigger);
    values.push(result.value);
    queue.push(...(result.enqueued ?? []).map((enqueued) => ({ ...enqueued, depth: trigger.depth + 1 })));
    queue.sort(compareTrigger);
  }
  return { ok: true, values };
}
function compareTrigger(left, right) {
  return left.eventSequence - right.eventSequence || left.sourceInstanceId.localeCompare(right.sourceInstanceId) || left.effectId.localeCompare(right.effectId);
}

// packages/domain/src/battle/lifecycleEffects.ts
var MAX_TRIGGER_DEPTH = 64;
function resolveLifecycleEffects(state, initialEvents) {
  let next = state;
  const produced = [];
  const queue = initialEvents.map((event2) => ({ event: event2, depth: 0 })).sort(compareQueuedEvent);
  const visited = /* @__PURE__ */ new Set();
  while (queue.length > 0) {
    const { event: event2, depth } = queue.shift();
    const trigger = event2.type === "creature.summoned" ? "summon" : event2.type === "creature.moved" ? "moved" : event2.type === "creature.destroyed" ? "destroyed" : void 0;
    if (!trigger || !event2.instanceId) continue;
    const sources = trigger === "destroyed" ? destroyedSources(next, event2.instanceId) : [event2.instanceId];
    for (const sourceId of sources.sort()) {
      const source = next.cardInstances[sourceId];
      if (!source) continue;
      for (const effect of getExecutableEffects(source, trigger)) {
        const pending = {
          eventSequence: event2.sequence,
          sourceInstanceId: sourceId,
          effectId: effect.effectId,
          depth,
          snapshot: { controllerSide: source.controllerSide, targetIds: lifecycleTargetIds(event2) }
        };
        const key = `${pending.eventSequence}:${pending.sourceInstanceId}:${pending.effectId}`;
        if (visited.has(key)) continue;
        if (pending.depth > MAX_TRIGGER_DEPTH || visited.size >= MAX_TRIGGER_DEPTH) {
          return { accepted: false, state, events: [], rejection: "trigger-loop" };
        }
        visited.add(key);
        const selection = lifecycleSelection(event2, trigger);
        const resolved = resolveEffect({ state: next, sourceInstanceId: sourceId, controllerSide: source.controllerSide, effect, selection, firstSequence: next.eventCursor + produced.length + 1 });
        if (!resolved.accepted) continue;
        next = resolved.state;
        produced.push(...resolved.events);
        queue.push(...resolved.events.map((generated) => ({ event: generated, depth: pending.depth + 1 })));
        queue.sort(compareQueuedEvent);
      }
    }
  }
  return { accepted: true, state: produced.length ? { ...next, eventCursor: produced.at(-1).sequence } : next, events: produced };
}
function lifecycleTargetIds(event2) {
  return event2.instanceId ? [event2.instanceId] : [];
}
function compareQueuedEvent(left, right) {
  return left.event.sequence - right.event.sequence || left.depth - right.depth || (left.event.instanceId ?? "").localeCompare(right.event.instanceId ?? "");
}
function destroyedSources(state, destroyedId) {
  const destroyed = state.cardInstances[destroyedId];
  const own = destroyed?.controllerSide;
  return Object.values(state.cardInstances).filter((card) => card.catalogCardId === "AK-056" && card.zone === "board" && card.instanceId !== destroyedId && card.controllerSide === own).map((card) => card.instanceId).concat(destroyed?.catalogCardId === "AK-010" || destroyed?.catalogCardId === "AK-049" || destroyed?.catalogCardId === "AK-051" || destroyed?.catalogCardId === "AK-058" ? [destroyedId] : []);
}
function lifecycleSelection(event2, trigger) {
  if (trigger !== "destroyed") return { kind: "none" };
  const column = event2.data?.previousColumn;
  const row = event2.data?.previousRow;
  return typeof column === "number" && typeof row === "number" ? { kind: "structured", value: { coordinates: [{ column, row }] } } : { kind: "none" };
}

// packages/domain/src/battle/automaticPhases.ts
function resolveAfterPlayPhase(state, side, firstSequence) {
  const phaseEnded = {
    sequence: firstSequence,
    type: "phase.ended",
    side,
    message: `${labelSide6(side)} ended the play phase.`
  };
  const attack = resolveAttackPhase(
    { ...state, phase: "automatic", eventCursor: firstSequence },
    side,
    firstSequence + 1
  );
  if (attack.state.terminalResult) {
    return {
      state: attack.state,
      events: [phaseEnded, ...attack.events]
    };
  }
  const light = resolveLightResonance(attack.state, side, firstSequence + attack.events.length + 1);
  const nextSide = side === "player" ? "cpu" : "player";
  const standby = resolveStandbyPhase(
    {
      ...light.state,
      activeSide: nextSide,
      metadata: {
        ...attack.state.metadata,
        turnNumber: side === "cpu" ? attack.state.metadata.turnNumber + 1 : attack.state.metadata.turnNumber
      }
    },
    nextSide,
    light.nextSequence
  );
  return {
    state: {
      ...standby.state,
      phase: "play",
      activeSide: nextSide
    },
    events: [phaseEnded, ...attack.events, ...light.events, ...standby.events]
  };
}
function resolveLightResonance(state, side, firstSequence) {
  const activeLanes = BATTLE_LANES.filter((lane) => isResonanceActive(state.players[side].resonance, lane, "light"));
  if (activeLanes.length === 0) return { state, events: [], nextSequence: firstSequence };
  const laneSet = new Set(activeLanes);
  const cardInstances = Object.fromEntries(Object.entries(state.cardInstances).map(([id, card]) => {
    if (card.controllerSide !== side || card.zone !== "board" || !card.position || !laneSet.has(getLane(card.position.column))) return [id, card];
    return [id, { ...card, currentHp: Math.min(card.maxHp ?? card.currentHp ?? 0, (card.currentHp ?? 0) + 1) }];
  }));
  const bases = Object.fromEntries(BATTLE_BASE_IDS.map((id) => {
    const base = state.bases[id];
    const shouldHeal = base.kind === "player-base" && base.owner === side || base.kind === "neutral-base" && base.owner === side && laneSet.has(getLane(base.coordinate.column));
    return [id, shouldHeal ? { ...base, currentHp: Math.min(base.maxHp, base.currentHp + (base.kind === "player-base" ? activeLanes.length : 1)) } : base];
  }));
  return { state: { ...state, cardInstances, bases, eventCursor: firstSequence }, events: [{ sequence: firstSequence, type: "resonance.effect-resolved", side, message: "Light resonance restored allied units and bases." }], nextSequence: firstSequence + 1 };
}
function resolveStandbyPhase(state, side, firstSequence) {
  const player = state.players[side];
  const nextTurnsStarted = player.turnsStarted + 1;
  const nextMaxPp = Math.min(BATTLE_MAX_PP, player.maxPp + 1);
  let nextPlayer = {
    ...player,
    turnsStarted: nextTurnsStarted,
    maxPp: nextMaxPp,
    currentPp: nextMaxPp,
    resonanceUsage: {
      water: { left: false, center: false, right: false },
      wind: { left: false, center: false, right: false },
      dark: player.resonanceUsage.dark
    }
  };
  let nextCardInstances = Object.fromEntries(Object.entries(state.cardInstances).map(([id, card]) => [
    id,
    card.movementOverrideExpiresOnSide === side ? { ...card, movementOverride: void 0, movementOverrideExpiresOnSide: void 0 } : card
  ]));
  const events = [{
    sequence: firstSequence,
    type: "standby.resolved",
    side,
    message: `${labelSide6(side)} recovered to ${nextMaxPp} PP.`,
    data: {
      maxPp: nextMaxPp
    }
  }];
  if (nextPlayer.deckZone.length === 0) {
    const sequence2 = firstSequence + events.length;
    events.push({
      sequence: sequence2,
      type: "deck-out.occurred",
      side,
      message: `${labelSide6(side)} could not draw from an empty deck.`
    });
    const drawFailedState = {
      ...state,
      activeSide: side,
      players: resetDarkUsageAtTurnStart({ ...state.players, [side]: nextPlayer }),
      eventCursor: sequence2
    };
    const terminal = evaluateBattleTerminal(
      drawFailedState,
      { kind: "draw-failed", losingSide: side },
      sequence2 + 1
    );
    const applied = terminal ? applyTerminalResult(drawFailedState, terminal, sequence2 + 1) : { state: drawFailedState, events: [], nextSequence: sequence2 + 1 };
    return {
      state: applied.state,
      events: [...events, ...applied.events]
    };
  }
  const drawnId = nextPlayer.deckZone[0];
  const remainingDeck = nextPlayer.deckZone.slice(1);
  const overflow = nextPlayer.handZone.length >= BATTLE_HAND_LIMIT;
  const drawnCard = nextCardInstances[drawnId];
  const sequence = firstSequence + events.length;
  nextCardInstances = {
    ...nextCardInstances,
    [drawnId]: {
      ...drawnCard,
      zone: overflow ? "graveyard" : "hand"
    }
  };
  nextPlayer = {
    ...nextPlayer,
    deckZone: remainingDeck,
    handZone: overflow ? nextPlayer.handZone : [...nextPlayer.handZone, drawnId],
    graveyardZone: overflow ? [...nextPlayer.graveyardZone, drawnId] : nextPlayer.graveyardZone
  };
  events.push({
    sequence,
    type: overflow ? "card.overflowed" : "card.drawn",
    side,
    instanceId: drawnId,
    message: overflow ? `${labelSide6(side)} hand was full; the drawn card went to graveyard.` : `${labelSide6(side)} drew a card.`
  });
  return {
    state: {
      ...state,
      phase: "play",
      activeSide: side,
      players: resetDarkUsageAtTurnStart({ ...state.players, [side]: nextPlayer }),
      cardInstances: nextCardInstances,
      metadata: {
        ...state.metadata,
        rng: createRngFromState(state.metadata.rng).state
      },
      eventCursor: sequence
    },
    events
  };
}
function resetDarkUsageAtTurnStart(players) {
  return Object.fromEntries(Object.keys(players).map((side) => {
    const player = players[side];
    return [side, {
      ...player,
      resonanceUsage: {
        ...player.resonanceUsage,
        dark: Object.fromEntries(BATTLE_LANES.map((lane) => [
          lane,
          isResonanceActive(player.resonance, lane, "dark") ? false : player.resonanceUsage.dark[lane]
        ]))
      }
    }];
  }));
}
function labelSide6(side) {
  return side === "player" ? "Player" : "CPU";
}

// packages/domain/src/battle/engine.ts
var GameEngine = {
  submitCommand(state, command) {
    const issues = validateBattleCommand(state, command);
    if (issues.length > 0) {
      return {
        ok: false,
        state,
        issues
      };
    }
    switch (command.type) {
      case "summonCreature":
        return acceptSummon(state, command);
      case "castSpell":
        return acceptSpell(state, command);
      case "moveCreature":
        return acceptMove(state, command);
      case "endPlayPhase":
        return acceptEndPlayPhase(state, command.side);
      case "resign":
        return acceptResignation(state, command.side);
    }
  }
};
function acceptResignation(state, side) {
  const sequence = state.eventCursor + 1;
  const terminalResult = evaluateBattleTerminal(
    state,
    { kind: "quit", losingSide: side },
    sequence
  );
  if (!terminalResult) {
    return {
      ok: false,
      state,
      issues: [{ code: "battle.terminal", message: "The battle has already ended." }]
    };
  }
  const resolution = applyTerminalResult(state, terminalResult, sequence);
  return {
    ok: true,
    state: resolution.state,
    events: resolution.events
  };
}
function acceptSummon(state, command) {
  const card = state.cardInstances[command.handInstanceId];
  const player = state.players[command.side];
  const lane = getLane(command.destination.column);
  const windDiscountUsed = isWindResonanceDiscountAvailable(state, command.side, lane);
  const paidCost = getCreaturePlayCost(state, command.side, card, lane);
  const resonance = increaseResonance(player.resonance, lane, card.attribute, resonanceGain(card.cost));
  const nextPlayer = {
    ...player,
    handZone: player.handZone.filter((id) => id !== card.instanceId),
    currentPp: player.currentPp - paidCost,
    resonance,
    resonanceUsage: {
      ...player.resonanceUsage,
      wind: {
        ...player.resonanceUsage.wind,
        [lane]: player.resonanceUsage.wind[lane] || windDiscountUsed
      },
      dark: refreshDarkUsageOnActivation(player.resonance, resonance, player.resonanceUsage.dark)
    }
  };
  const sequence = state.eventCursor + 1;
  const events = [
    {
      sequence,
      type: "creature.summoned",
      side: command.side,
      instanceId: card.instanceId,
      message: `${labelSide7(command.side)} summoned ${card.name}.`
    },
    {
      sequence: sequence + 1,
      type: "resonance.changed",
      side: command.side,
      instanceId: card.instanceId,
      message: `${card.attribute} resonance increased in the ${lane} lane.`
    }
  ];
  const summonedState = {
    ...state,
    board: setBoardOccupant(state.board, command.destination, card.instanceId),
    players: {
      ...state.players,
      [command.side]: nextPlayer
    },
    cardInstances: {
      ...state.cardInstances,
      [card.instanceId]: {
        ...card,
        zone: "board",
        position: command.destination,
        boardEntrySequence: sequence,
        summonedThisTurn: true
      }
    },
    eventCursor: sequence + events.length - 1
  };
  const resolvedCard = { ...card, zone: "board", position: command.destination };
  const summonEffects = !command.effectSelection && hasTargetedSummonEffect(card) ? [] : getExecutablePlayEffects(resolvedCard);
  const resolution = resolveOrderedEffects(
    summonedState,
    card.instanceId,
    command.side,
    summonEffects,
    toEffectSelection(command.effectSelection)
  );
  const effectEvents = resolution.events;
  const stateBeforeLifecycle = {
    ...resolution.state,
    eventCursor: effectEvents.at(-1)?.sequence ?? summonedState.eventCursor
  };
  const lifecycle = resolveLifecycleEffects(stateBeforeLifecycle, effectEvents);
  if (!lifecycle.accepted) return triggerLoopRejected(state);
  return {
    ok: true,
    state: { ...lifecycle.state, eventCursor: lifecycle.events.at(-1)?.sequence ?? effectEvents.at(-1)?.sequence ?? summonedState.eventCursor },
    events: [...events, ...effectEvents, ...lifecycle.events],
    ...resolution.effect ? { effect: resolution.effect } : {}
  };
}
function acceptSpell(state, command) {
  const card = state.cardInstances[command.handInstanceId];
  const player = state.players[command.side];
  const movedToGraveyard = {
    ...card,
    zone: "graveyard"
  };
  const spentState = {
    ...state,
    players: {
      ...state.players,
      [command.side]: {
        ...player,
        handZone: player.handZone.filter((id) => id !== card.instanceId),
        graveyardZone: [...player.graveyardZone, card.instanceId],
        currentPp: player.currentPp - card.currentCost
      }
    },
    cardInstances: {
      ...state.cardInstances,
      [card.instanceId]: movedToGraveyard
    }
  };
  const resolution = resolveOrderedEffects(
    spentState,
    card.instanceId,
    command.side,
    getExecutablePlayEffects(card),
    toEffectSelection(command.effectSelection, command.targetInstanceId, command.targetBaseId)
  );
  const resolvedState = resolution.state;
  const effectEvents = resolution.events;
  const firstEventSequence = state.eventCursor + effectEvents.length + 1;
  const events = [
    ...effectEvents,
    { sequence: firstEventSequence, type: "spell.resolved", side: command.side, instanceId: card.instanceId, message: `${labelSide7(command.side)} cast ${card.name}.`, data: { effectSourceInstanceId: card.instanceId } },
    ...BATTLE_LANES.map((lane, index) => ({ sequence: firstEventSequence + 1 + index, type: "resonance.changed", side: command.side, instanceId: card.instanceId, message: `${card.attribute} resonance increased in the ${lane} lane.` }))
  ];
  const nextPlayer = resolvedState.players[command.side];
  const resonance = BATTLE_LANES.reduce((current, lane) => increaseResonance(current, lane, card.attribute, 1), nextPlayer.resonance);
  const stateBeforeLifecycle = { ...resolvedState, eventCursor: events.at(-1)?.sequence ?? state.eventCursor };
  const lifecycle = resolveLifecycleEffects(stateBeforeLifecycle, effectEvents);
  if (!lifecycle.accepted) return triggerLoopRejected(state);
  const lifecycleEvents = lifecycle.events;
  return {
    ok: true,
    state: {
      ...lifecycle.state,
      players: {
        ...lifecycle.state.players,
        [command.side]: {
          ...lifecycle.state.players[command.side],
          resonance,
          resonanceUsage: {
            ...lifecycle.state.players[command.side].resonanceUsage,
            dark: refreshDarkUsageOnActivation(nextPlayer.resonance, resonance, lifecycle.state.players[command.side].resonanceUsage.dark)
          }
        }
      },
      eventCursor: lifecycleEvents.at(-1)?.sequence ?? events.at(-1)?.sequence ?? state.eventCursor
    },
    events: [...events, ...lifecycleEvents],
    ...resolution.effect ? { effect: resolution.effect } : {}
  };
}
function resolveOrderedEffects(initialState, sourceInstanceId, controllerSide, effects, selection) {
  let state = initialState;
  const events = [];
  let completedOperationCount = 0;
  let resolved = false;
  let firstFailure;
  for (const effect of effects) {
    const result = resolveEffect({ state, sourceInstanceId, controllerSide, effect, selection, firstSequence: initialState.eventCursor + events.length + 1 });
    if (!result.accepted) continue;
    state = result.state;
    events.push(...result.events);
    completedOperationCount += result.effect.completedOperationCount;
    resolved ||= result.effect.status === "resolved";
    firstFailure ??= result.effect.failedOperation;
  }
  return effects.length === 0 ? { state, events } : { state, events, effect: { status: resolved ? "resolved" : "fizzled", completedOperationCount, ...firstFailure ? { failedOperation: firstFailure } : {} } };
}
function acceptMove(state, command) {
  const card = state.cardInstances[command.creatureInstanceId];
  const destination = command.path[command.path.length - 1];
  const sequence = state.eventCursor + 1;
  const lane = getLane(command.origin.column);
  const player = state.players[command.side];
  const activatesWaterResonance = isResonanceActive(player.resonance, lane, "water") && !player.resonanceUsage.water[lane];
  const events = [
    {
      sequence,
      type: "creature.moved",
      side: command.side,
      instanceId: card.instanceId,
      message: `${labelSide7(command.side)} moved ${card.name}.`
    }
  ];
  const movedState = {
    ...state,
    board: setBoardOccupant(
      setBoardOccupant(state.board, command.origin, void 0),
      destination,
      card.instanceId
    ),
    players: activatesWaterResonance ? { ...state.players, [command.side]: { ...player, resonanceUsage: { ...player.resonanceUsage, water: { ...player.resonanceUsage.water, [lane]: true } } } } : state.players,
    cardInstances: {
      ...state.cardInstances,
      [card.instanceId]: {
        ...card,
        position: destination,
        movedThisTurn: true,
        ...activatesWaterResonance ? { temporaryMovementBonus: (card.temporaryMovementBonus ?? 0) + 1 } : {}
      }
    },
    eventCursor: sequence
  };
  const resonanceEvents = activatesWaterResonance ? [...events, { sequence: sequence + 1, type: "resonance.effect-resolved", side: command.side, instanceId: card.instanceId, message: `Water resonance increased ${card.name}'s movement.` }] : events;
  const resonanceState = activatesWaterResonance ? { ...movedState, eventCursor: sequence + 1 } : movedState;
  const lifecycle = resolveLifecycleEffects(resonanceState, resonanceEvents);
  if (!lifecycle.accepted) return triggerLoopRejected(state);
  return { ok: true, state: { ...lifecycle.state, eventCursor: lifecycle.events.at(-1)?.sequence ?? resonanceEvents.at(-1)?.sequence ?? sequence }, events: [...resonanceEvents, ...lifecycle.events] };
}
function acceptEndPlayPhase(state, side) {
  const resolution = resolveAfterPlayPhase(state, side, state.eventCursor + 1);
  const lifecycle = resolveLifecycleEffects(resolution.state, resolution.events);
  if (!lifecycle.accepted) return triggerLoopRejected(state);
  const resetState = resetTurnFlags(lifecycle.state, side, lifecycle.state.activeSide);
  return {
    ok: true,
    state: resetState,
    events: [...resolution.events, ...lifecycle.events]
  };
}
function resetTurnFlags(state, endingSide, nextSide) {
  const nextCards = Object.fromEntries(
    Object.entries(state.cardInstances).map(([id, card]) => [
      id,
      card.controllerSide === endingSide || card.controllerSide === nextSide ? {
        ...card,
        ...card.controllerSide === nextSide ? {
          summonedThisTurn: false,
          movedThisTurn: false,
          effectUsesThisTurn: void 0
        } : {},
        ...card.controllerSide === endingSide ? { temporaryMovementBonus: void 0 } : {}
      } : card
    ])
  );
  return {
    ...state,
    cardInstances: nextCards
  };
}
function refreshDarkUsageOnActivation(previous, next, usage) {
  return Object.fromEntries(BATTLE_LANES.map((lane) => [
    lane,
    !isResonanceActive(previous, lane, "dark") && isResonanceActive(next, lane, "dark") ? false : usage[lane]
  ]));
}
function labelSide7(side) {
  return side === "player" ? "Player" : "CPU";
}
function triggerLoopRejected(state) {
  return { ok: false, state, issues: [{ code: "battle.effect.trigger-loop", path: "effects", message: "Lifecycle effect trigger limit was exceeded." }] };
}

// packages/domain/src/battle/projection.ts
function projectPublicBattleView(state) {
  const bases = BATTLE_BASE_IDS.map((id) => projectBattleBaseView(state.bases[id]));
  const basesById = new Map(bases.map((base) => [base.id, base]));
  return {
    phase: state.phase,
    activeSide: state.activeSide,
    turnNumber: state.metadata.turnNumber,
    bases,
    playerCurrentPp: state.players.player.currentPp,
    playerMaxPp: state.players.player.maxPp,
    playerResonance: state.players.player.resonance,
    cpuCurrentPp: state.players.cpu.currentPp,
    cpuMaxPp: state.players.cpu.maxPp,
    cpuResonance: state.players.cpu.resonance,
    cpuHandCount: state.players.cpu.handZone.length,
    playerDeckCount: state.players.player.deckZone.length,
    cpuDeckCount: state.players.cpu.deckZone.length,
    playerHand: state.players.player.handZone.map(
      (instanceId) => projectBattleCard(instanceId, state.cardInstances[instanceId], "hand", state)
    ),
    playerGraveyard: state.players.player.graveyardZone.map(
      (instanceId) => projectBattleCard(instanceId, state.cardInstances[instanceId], "graveyard", state)
    ),
    cpuGraveyard: state.players.cpu.graveyardZone.map(
      (instanceId) => projectBattleCard(instanceId, state.cardInstances[instanceId], "graveyard", state)
    ),
    effectChoices: getPublicEffectChoices(state, "player"),
    boardSquares: state.board.squares.map((square) => {
      const base = getBattleBaseAt(state.bases, square.coordinate);
      return {
        key: coordinateKey(square.coordinate),
        coordinate: square.coordinate,
        lane: square.lane,
        terrain: square.terrain,
        base: base ? basesById.get(base.id) : void 0,
        occupant: square.occupantId ? projectBattleCard(
          square.occupantId,
          state.cardInstances[square.occupantId],
          "board",
          state
        ) : void 0
      };
    }),
    terminalResult: state.terminalResult
  };
}
function projectBattleBaseView(base) {
  return {
    id: base.id,
    label: getBattleBaseLabel(base.id),
    coordinate: { ...base.coordinate },
    kind: base.kind,
    owner: base.owner,
    currentHp: base.currentHp,
    maxHp: base.maxHp
  };
}
function projectBattleCard(instanceId, card, location, state) {
  if (!card) {
    return {
      instanceId,
      catalogCardId: `unknown-${instanceId}`,
      name: "Unknown card",
      type: "unknown",
      attribute: "unknown",
      controllerSide: "unknown",
      presentationStatus: "unavailable",
      isInspectable: true,
      isActionable: false,
      disabledReason: "Card data is unavailable.",
      effectText: "",
      ownerLabel: "Unknown"
    };
  }
  const isCreature3 = card.type === "creature" || card.type === "creature-token";
  const summonStart = location === "hand" && isCreature3 && state ? querySummonStart(state, "player", card.instanceId) : void 0;
  const movementStart = location === "board" && isCreature3 && state ? queryMovementStart(state, "player", card.instanceId) : void 0;
  const spellIssues = location === "hand" && card.type === "spell" && state ? validateBattleCommand(state, {
    type: "castSpell",
    side: "player",
    handInstanceId: card.instanceId
  }) : void 0;
  const spellChoice = location === "hand" && card.type === "spell" && state ? getEffectChoiceForCard(state, "player", card) : void 0;
  const spellIsActionable = spellIssues !== void 0 && (spellIssues.length === 0 || Boolean(
    spellIssues.every((issue) => issue.code === "battle.effect.no-target") && spellChoice && spellChoice.candidates.length > 0
  ));
  const isActionable = spellIssues !== void 0 ? spellIsActionable : summonStart?.eligible ?? movementStart?.eligible ?? false;
  const disabledReason = card.type === "spell" ? spellIsActionable ? void 0 : spellIssues?.[0]?.code : location === "hand" ? summonStart?.issues[0]?.code : movementStart?.issues[0]?.code;
  return {
    instanceId: card.instanceId,
    catalogCardId: card.catalogCardId,
    name: card.name,
    type: card.type,
    attribute: card.attribute,
    controllerSide: card.controllerSide,
    presentationStatus: "available",
    currentCost: Math.max(0, state && location === "hand" && isCreature3 ? getEffectiveCreatureHandCost(state, card) : card.currentCost),
    ...isCreature3 ? {
      // Resonance bonuses are derived from the current battle state so a
      // lane changes or resonance changes are reflected without mutating the
      // card's persistent base/current attack.
      currentAttack: state ? getEffectiveCreatureAttack(state, card) : card.currentAttack ?? card.attack,
      currentHp: state ? getEffectiveCreatureCurrentHp(state, card) : card.currentHp,
      maxHp: state ? getEffectiveCreatureMaxHp(state, card) : card.maxHp,
      // The water resonance bonus is a temporary derived value, like the
      // fire attack bonus.  Project it so both the card display and any
      // caller using the public view see the actual movement limit.
      movement: state ? getEffectiveCreatureMovement(state, card) : Math.max(0, card.movementOverride ?? card.movement + (card.temporaryMovementBonus ?? 0)),
      ...location === "board" ? {
        summonedThisTurn: card.summonedThisTurn,
        movedThisTurn: card.movedThisTurn
      } : {}
    } : {},
    isInspectable: true,
    effectText: card.effectText,
    isActionable,
    disabledReason,
    ownerLabel: labelSide8(card.controllerSide)
  };
}
function labelSide8(side) {
  return side === "player" ? "Player" : "CPU";
}
export {
  BATTLE_BASE_IDS,
  BATTLE_BASE_MOVEMENT,
  BATTLE_BOARD_COLUMNS,
  BATTLE_BOARD_ROWS,
  BATTLE_HAND_LIMIT,
  BATTLE_LANES,
  BATTLE_LOG_LIMIT,
  BATTLE_MAX_PP,
  BATTLE_STARTING_HAND_SIZE,
  BATTLE_STARTING_PP,
  CANONICAL_BOARD_COORDINATES,
  CPU_ACCEPTED_COMMAND_LIMIT,
  EXISTING_BOARD_COLUMNS_BY_ROW,
  GameEngine,
  HUMAN_PLAY_PHASE_SECONDS,
  INITIAL_SUMMON_COORDINATES_BY_SIDE,
  RESONANCE_ACTIVE_THRESHOLD,
  RESONANCE_MAX,
  appendBattleLogEntries,
  applyBaseDamage,
  applyCreatureDamage,
  applyTerminalResult,
  captureNeutralBase,
  clampResonance,
  coordinateKey,
  createBattleRng,
  createBattleState,
  createEmptyBattleLog,
  createEmptyResonance,
  createEmptyResonanceUsage,
  createInitialBattleBases,
  createInitialBattleBoard,
  createRngFromState,
  destroyCreature,
  drainTriggers,
  evaluateBattleTerminal,
  evaluateMovementDraft,
  eventToLogEntry,
  expireModifiers,
  generateLegalActions,
  getAdjacentBoardCoordinates,
  getBattleBaseAt,
  getBattleBaseById,
  getBattleBaseLabel,
  getBoardSquare,
  getCreaturePlayCost,
  getEffectChoiceForCard,
  getEffectiveCreatureAttack,
  getEffectiveCreatureCurrentHp,
  getEffectiveCreatureHandCost,
  getEffectiveCreatureMaxHp,
  getEffectiveCreatureMovement,
  getEffectiveModifiedValue,
  getExecutableEffects,
  getExecutablePlayEffects,
  getFirstValidationMessage,
  getLane,
  getLegalEffectTargets,
  getNextMovementSteps,
  getOccupantId,
  getOwnedNeutralBases,
  getPlayerBaseId,
  getPublicEffectChoices,
  getShortestMovementPaths,
  getSummonDestinations,
  getSummonRangeCoordinates,
  getTerrain,
  hasAllNeutralBases,
  hasTargetedSummonEffect,
  increaseResonance,
  isAdjacentStep,
  isBaseAttackable,
  isExistingBoardCoordinate,
  isInitialSummonCoordinate,
  isInsideBoard,
  isNormalBoardCoordinate,
  isResonanceActive,
  isWindResonanceDiscountAvailable,
  isWithinBasicAttackRange,
  listAttackersInBoardOrder,
  placeCreatureForTest,
  projectBattleBaseView,
  projectPublicBattleView,
  queryMovementStart,
  querySummonStart,
  resolveAfterPlayPhase,
  resolveAttackPhase,
  resolveCreatureAttack,
  resolveEffect,
  resolveLifecycleEffects,
  resolveSimpleSpellEffect,
  resolveStandbyPhase,
  resonanceGain,
  sameCoordinate,
  setBoardOccupant,
  shuffleWithRng,
  snapshotAttackTargets,
  toEffectSelection,
  updateBattleBase,
  validateAttackTarget,
  validateBattleCommand,
  validateMovementPath,
  validateMovementSource,
  validateSummonDestination,
  validateSummonSource
};

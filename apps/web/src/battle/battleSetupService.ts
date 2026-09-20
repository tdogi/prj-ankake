import {
  createBattleState,
  type BattleSetupResult,
  type FirstPlayerMode,
  type SavedDeckSummary,
  type StaticCatalogSnapshot
} from "@ankake/domain";
import type { DeckRepository } from "@ankake/persistence";

export interface BattlePreparationState {
  readonly deckOptions: readonly SavedDeckSummary[];
  readonly playerDeckId?: string;
  readonly cpuDeckId?: string;
  readonly firstPlayerMode: FirstPlayerMode;
  readonly loading: boolean;
  readonly error?: string;
}

export async function loadBattlePreparation(
  repository: DeckRepository,
  preferredPlayerDeckId?: string
): Promise<BattlePreparationState> {
  const result = await repository.listDecks();

  if (!result.ok) {
    return {
      deckOptions: [],
      firstPlayerMode: "random",
      loading: false,
      error: result.error.message
    };
  }

  const battleReady = result.value.filter((deck) => deck.battleReady);
  return {
    deckOptions: result.value,
    playerDeckId: battleReady.some((deck) => deck.deckId === preferredPlayerDeckId)
      ? preferredPlayerDeckId
      : battleReady[0]?.deckId,
    cpuDeckId: battleReady[1]?.deckId ?? battleReady[0]?.deckId,
    firstPlayerMode: "random",
    loading: false
  };
}

export interface StartBattleInput {
  readonly repository: DeckRepository;
  readonly catalog: StaticCatalogSnapshot;
  readonly playerDeckId: string;
  readonly cpuDeckId: string;
  readonly firstPlayerMode: FirstPlayerMode;
}

export async function startBattle(input: StartBattleInput): Promise<BattleSetupResult> {
  const [playerDeckResult, cpuDeckResult] = await Promise.all([
    input.repository.loadDeck(input.playerDeckId),
    input.repository.loadDeck(input.cpuDeckId)
  ]);

  if (!playerDeckResult.ok) {
    return {
      ok: false,
      issues: [
        {
          code: "battle-setup.player-deck-invalid",
          message: playerDeckResult.error.message
        }
      ]
    };
  }

  if (!cpuDeckResult.ok) {
    return {
      ok: false,
      issues: [
        {
          code: "battle-setup.cpu-deck-invalid",
          message: cpuDeckResult.error.message
        }
      ]
    };
  }

  return createBattleState({
    playerDeck: playerDeckResult.value,
    cpuDeck: cpuDeckResult.value,
    firstPlayerMode: input.firstPlayerMode,
    catalog: input.catalog,
    now: new Date().toISOString()
  });
}

export function getBattleStartDisabledReason(state: BattlePreparationState): string | undefined {
  if (state.loading) {
    return "Battle setup is loading.";
  }

  const battleReady = state.deckOptions.filter((deck) => deck.battleReady);

  if (battleReady.length === 0) {
    return "Create at least one battle-ready 40-card deck first.";
  }

  if (!state.playerDeckId || !state.cpuDeckId) {
    return "Select player and CPU decks.";
  }

  const playerDeck = state.deckOptions.find((deck) => deck.deckId === state.playerDeckId);
  const cpuDeck = state.deckOptions.find((deck) => deck.deckId === state.cpuDeckId);

  if (!playerDeck?.battleReady || !cpuDeck?.battleReady) {
    return "Both selected decks must be battle-ready.";
  }

  return undefined;
}

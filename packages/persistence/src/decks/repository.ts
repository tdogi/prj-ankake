import type {
  DeckId,
  SavedDeck,
  SavedDeckSummary
} from "@ankake/domain";

export type PersistenceOperation =
  | "deck.list"
  | "deck.load"
  | "deck.save"
  | "deck.delete"
  | "online-display-name.load"
  | "online-display-name.save";

export type PersistenceErrorCode =
  | "storage.unavailable"
  | "storage.open-failed"
  | "storage.read-failed"
  | "storage.write-failed"
  | "storage.delete-failed"
  | "deck.not-found"
  | "deck.malformed-record";

export interface PersistenceError {
  readonly code: PersistenceErrorCode;
  readonly operation: PersistenceOperation;
  readonly message: string;
  readonly cause?: unknown;
}

export type RepositoryResult<T> =
  | {
      readonly ok: true;
      readonly value: T;
    }
  | {
      readonly ok: false;
      readonly error: PersistenceError;
    };

export interface DeckRepository {
  listDecks(): Promise<RepositoryResult<readonly SavedDeckSummary[]>>;
  loadDeck(deckId: DeckId): Promise<RepositoryResult<SavedDeck>>;
  saveDeck(savedDeck: SavedDeck): Promise<RepositoryResult<SavedDeck>>;
  deleteDeck(deckId: DeckId): Promise<RepositoryResult<void>>;
}

export function ok<T>(value: T): RepositoryResult<T> {
  return {
    ok: true,
    value
  };
}

export function persistenceError(
  operation: PersistenceOperation,
  code: PersistenceErrorCode,
  message: string,
  cause?: unknown
): RepositoryResult<never> {
  return {
    ok: false,
    error: {
      operation,
      code,
      message,
      cause
    }
  };
}

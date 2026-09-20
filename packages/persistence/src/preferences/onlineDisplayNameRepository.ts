import {
  ok,
  persistenceError,
  type RepositoryResult
} from "../decks/repository";

export const DEFAULT_ONLINE_PREFERENCES_DATABASE_NAME = "ankake-local-online-preferences";
export const DEFAULT_ONLINE_PREFERENCES_STORE_NAME = "preferences";
export const DEFAULT_ONLINE_PREFERENCES_DATABASE_VERSION = 1;
export const ONLINE_DISPLAY_NAME_PREFERENCE_KEY = "online-display-name";

interface OnlineDisplayNameRecord {
  readonly key: typeof ONLINE_DISPLAY_NAME_PREFERENCE_KEY;
  readonly value: string;
}

export interface OnlineDisplayNameRepository {
  loadDisplayName(): Promise<RepositoryResult<string>>;
  saveDisplayName(value: string): Promise<RepositoryResult<void>>;
}

export interface IndexedDbOnlineDisplayNameRepositoryOptions {
  readonly indexedDb?: IDBFactory;
  readonly databaseName?: string;
  readonly storeName?: string;
}

/** Stores only the last display name locally; match data and passphrases are excluded. */
export class IndexedDbOnlineDisplayNameRepository implements OnlineDisplayNameRepository {
  private readonly indexedDb?: IDBFactory;
  private readonly databaseName: string;
  private readonly storeName: string;

  constructor(options: IndexedDbOnlineDisplayNameRepositoryOptions = {}) {
    this.indexedDb = options.indexedDb ?? globalThis.indexedDB;
    this.databaseName = options.databaseName ?? DEFAULT_ONLINE_PREFERENCES_DATABASE_NAME;
    this.storeName = options.storeName ?? DEFAULT_ONLINE_PREFERENCES_STORE_NAME;
  }

  async loadDisplayName(): Promise<RepositoryResult<string>> {
    const databaseResult = await this.openDatabase("online-display-name.load");
    if (!databaseResult.ok) return databaseResult;
    const database = databaseResult.value;

    try {
      const transaction = database.transaction(this.storeName, "readonly");
      const record = await requestToPromise<OnlineDisplayNameRecord | undefined>(
        transaction.objectStore(this.storeName).get(ONLINE_DISPLAY_NAME_PREFERENCE_KEY)
      );
      await transactionDone(transaction);
      return ok(typeof record?.value === "string" ? record.value : "");
    } catch (cause) {
      return persistenceError("online-display-name.load", "storage.read-failed", "Unable to load the saved online display name.", cause);
    } finally {
      database.close();
    }
  }

  async saveDisplayName(value: string): Promise<RepositoryResult<void>> {
    const databaseResult = await this.openDatabase("online-display-name.save");
    if (!databaseResult.ok) return databaseResult;
    const database = databaseResult.value;

    try {
      const transaction = database.transaction(this.storeName, "readwrite");
      await requestToPromise(
        transaction.objectStore(this.storeName).put({ key: ONLINE_DISPLAY_NAME_PREFERENCE_KEY, value })
      );
      await transactionDone(transaction);
      return ok(undefined);
    } catch (cause) {
      return persistenceError("online-display-name.save", "storage.write-failed", "Unable to save the online display name.", cause);
    } finally {
      database.close();
    }
  }

  private async openDatabase(operation: "online-display-name.load" | "online-display-name.save"): Promise<RepositoryResult<IDBDatabase>> {
    if (!this.indexedDb) {
      return persistenceError(operation, "storage.unavailable", "IndexedDB is unavailable in this browser.");
    }

    try {
      const request = this.indexedDb.open(this.databaseName, DEFAULT_ONLINE_PREFERENCES_DATABASE_VERSION);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(this.storeName)) {
          database.createObjectStore(this.storeName, { keyPath: "key" });
        }
      };
      return ok(await requestToPromise(request));
    } catch (cause) {
      return persistenceError(operation, "storage.open-failed", "Unable to open online preference storage.", cause);
    }
  }
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

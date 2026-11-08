import {
  outboxAccountKey,
  parseGravityOutboxRecord,
  sameAccount,
  serializeGravityOutboxRecord,
  type GravityOutboxRecord,
  type OutboxAccount
} from "./gravity-outbox-record";

/** Durable storage for one account's queued gravity readings. */
export type GravityOutboxStore = {
  list(account: OutboxAccount): Promise<GravityOutboxRecord[]>;
  put(record: GravityOutboxRecord): Promise<void>;
  remove(account: OutboxAccount, clientEntryId: string): Promise<void>;
};

/**
 * The minimal file operations the store needs. Paths are segments relative
 * to the outbox root. The Expo adapter lives in `expo-outbox-file-system.ts`
 * so the store can be tested without native modules.
 */
export type OutboxFileSystem = {
  /** File names in a directory, or an empty list when it does not exist. */
  list(directory: readonly string[]): Promise<string[]>;
  /** File contents, or null when the file does not exist. */
  read(path: readonly string[]): Promise<string | null>;
  /** Replaces a file's contents; the caller supplies a temp-file strategy. */
  write(path: readonly string[], contents: string): Promise<void>;
  /** Renames a file, replacing any existing destination. */
  move(from: readonly string[], to: readonly string[]): Promise<void>;
  /** Removes a file if it exists. */
  remove(path: readonly string[]): Promise<void>;
};

const RECORD_SUFFIX = ".json";
const TEMP_SUFFIX = ".json.tmp";

function accountDirectory(account: OutboxAccount) {
  return ["v1", outboxAccountKey(account), "gravity"] as const;
}

/**
 * Stores one JSON file per reading inside an account-scoped directory. Each
 * write goes to a temporary file first and is then renamed over the record,
 * so a crash can leave at most a complete temporary copy. A temporary copy
 * without its record is recovered on the next read; a corrupt file is left
 * in place (never silently deleted) and skipped.
 */
export function createFileOutboxStore(
  fileSystem: OutboxFileSystem
): GravityOutboxStore {
  async function writeRecord(record: GravityOutboxRecord) {
    const directory = accountDirectory(record.account);
    const temp = [...directory, `${record.clientEntryId}${TEMP_SUFFIX}`];
    await fileSystem.write(temp, serializeGravityOutboxRecord(record));
    await fileSystem.move(temp, [
      ...directory,
      `${record.clientEntryId}${RECORD_SUFFIX}`
    ]);
  }

  return {
    async list(account) {
      const directory = accountDirectory(account);
      const names = new Set(await fileSystem.list(directory));
      const records: GravityOutboxRecord[] = [];

      for (const name of names) {
        if (name.endsWith(TEMP_SUFFIX)) {
          const recordName = `${name.slice(0, -TEMP_SUFFIX.length)}${RECORD_SUFFIX}`;
          if (names.has(recordName)) continue;
          const text = await fileSystem.read([...directory, name]);
          const recovered = text ? parseGravityOutboxRecord(text, account) : null;
          if (recovered) {
            await fileSystem.move([...directory, name], [...directory, recordName]);
            records.push(recovered);
          }
          continue;
        }

        if (!name.endsWith(RECORD_SUFFIX)) continue;
        const text = await fileSystem.read([...directory, name]);
        const record = text ? parseGravityOutboxRecord(text, account) : null;
        if (record && `${record.clientEntryId}${RECORD_SUFFIX}` === name) {
          records.push(record);
        }
      }

      return records.sort(compareRecords);
    },

    async put(record) {
      await writeRecord(record);
    },

    async remove(account, clientEntryId) {
      const directory = accountDirectory(account);
      await fileSystem.remove([...directory, `${clientEntryId}${RECORD_SUFFIX}`]);
      await fileSystem.remove([...directory, `${clientEntryId}${TEMP_SUFFIX}`]);
    }
  };
}

export function compareRecords(a: GravityOutboxRecord, b: GravityOutboxRecord) {
  return (
    a.createdAt.localeCompare(b.createdAt) ||
    a.clientEntryId.localeCompare(b.clientEntryId)
  );
}

/** Non-durable store for tests and unsupported platforms. */
export function createMemoryOutboxStore(): GravityOutboxStore & {
  snapshot(): GravityOutboxRecord[];
} {
  const records = new Map<string, GravityOutboxRecord>();
  const key = (account: OutboxAccount, id: string) =>
    `${outboxAccountKey(account)}/${id}`;

  return {
    async list(account) {
      return [...records.values()]
        .filter((record) => sameAccount(record.account, account))
        .sort(compareRecords);
    },
    async put(record) {
      records.set(key(record.account, record.clientEntryId), record);
    },
    async remove(account, clientEntryId) {
      records.delete(key(account, clientEntryId));
    },
    snapshot() {
      return [...records.values()].sort(compareRecords);
    }
  };
}

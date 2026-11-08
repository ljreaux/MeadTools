import {
  outboxAccountKey,
  parseOutboxRecord,
  sameAccount,
  serializeOutboxRecord,
  type BrewEntryOutboxRecord,
  type OutboxAccount
} from "./entry-outbox-record";

/** Durable storage for one account's queued brew entries. */
export type OutboxStore = {
  list(account: OutboxAccount): Promise<BrewEntryOutboxRecord[]>;
  put(record: BrewEntryOutboxRecord): Promise<void>;
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

function entriesDirectory(account: OutboxAccount) {
  return ["v1", outboxAccountKey(account), "entries"] as const;
}

/** Directory used by the gravity-only outbox before every entry type was queueable. */
function legacyGravityDirectory(account: OutboxAccount) {
  return ["v1", outboxAccountKey(account), "gravity"] as const;
}

/**
 * Stores one JSON file per entry inside an account-scoped directory. Each
 * write goes to a temporary file first and is then renamed over the record,
 * so a crash can leave at most a complete temporary copy. A temporary copy
 * without its record is recovered on the next read; a corrupt file is left
 * in place (never silently deleted) and skipped. Records from the earlier
 * gravity-only directory are migrated on read, new copy first.
 */
export function createFileOutboxStore(fileSystem: OutboxFileSystem): OutboxStore {
  async function writeRecord(record: BrewEntryOutboxRecord) {
    const directory = entriesDirectory(record.account);
    const temp = [...directory, `${record.clientEntryId}${TEMP_SUFFIX}`];
    await fileSystem.write(temp, serializeOutboxRecord(record));
    await fileSystem.move(temp, [...directory, `${record.clientEntryId}${RECORD_SUFFIX}`]);
  }

  async function readDirectory(
    directory: readonly string[],
    account: OutboxAccount
  ): Promise<BrewEntryOutboxRecord[]> {
    const names = new Set(await fileSystem.list(directory));
    const records: BrewEntryOutboxRecord[] = [];

    for (const name of names) {
      if (name.endsWith(TEMP_SUFFIX)) {
        const recordName = `${name.slice(0, -TEMP_SUFFIX.length)}${RECORD_SUFFIX}`;
        if (names.has(recordName)) continue;
        const text = await fileSystem.read([...directory, name]);
        const recovered = text ? parseOutboxRecord(text, account) : null;
        if (recovered) {
          await fileSystem.move([...directory, name], [...directory, recordName]);
          records.push(recovered);
        }
        continue;
      }

      if (!name.endsWith(RECORD_SUFFIX)) continue;
      const text = await fileSystem.read([...directory, name]);
      const record = text ? parseOutboxRecord(text, account) : null;
      if (record && `${record.clientEntryId}${RECORD_SUFFIX}` === name) {
        records.push(record);
      }
    }
    return records;
  }

  return {
    async list(account) {
      const current = await readDirectory(entriesDirectory(account), account);
      const byId = new Map(current.map((record) => [record.clientEntryId, record]));

      const legacyDirectory = legacyGravityDirectory(account);
      for (const legacy of await readDirectory(legacyDirectory, account)) {
        // Write the upgraded copy before removing the original, so a crash
        // during migration leaves the record readable from one place or both.
        if (!byId.has(legacy.clientEntryId)) {
          await writeRecord(legacy);
          byId.set(legacy.clientEntryId, legacy);
        }
        await fileSystem.remove([...legacyDirectory, `${legacy.clientEntryId}${RECORD_SUFFIX}`]);
      }

      return [...byId.values()].sort(compareRecords);
    },

    async put(record) {
      await writeRecord(record);
    },

    async remove(account, clientEntryId) {
      for (const directory of [entriesDirectory(account), legacyGravityDirectory(account)]) {
        await fileSystem.remove([...directory, `${clientEntryId}${RECORD_SUFFIX}`]);
        await fileSystem.remove([...directory, `${clientEntryId}${TEMP_SUFFIX}`]);
      }
    }
  };
}

export function compareRecords(a: BrewEntryOutboxRecord, b: BrewEntryOutboxRecord) {
  return (
    a.createdAt.localeCompare(b.createdAt) ||
    a.clientEntryId.localeCompare(b.clientEntryId)
  );
}

/** Non-durable store for tests and unsupported platforms. */
export function createMemoryOutboxStore(): OutboxStore & {
  snapshot(): BrewEntryOutboxRecord[];
} {
  const records = new Map<string, BrewEntryOutboxRecord>();
  const key = (account: OutboxAccount, id: string) => `${outboxAccountKey(account)}/${id}`;

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

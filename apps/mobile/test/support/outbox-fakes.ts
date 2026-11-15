import {
  createMeadToolsApiClient,
  type ApiRequestInit,
  type ApiResponse
} from "@meadtools/api-client";

import type { SendBrewEntry } from "../../src/outbox/entry-outbox";
import type { OutboxFileSystem } from "../../src/outbox/entry-outbox-store";

export const PREVIEW_ORIGIN = "https://preview.meadtools.example";
export const ACCOUNT_A = { userId: 7, apiOrigin: PREVIEW_ORIGIN };
export const ACCOUNT_B = { userId: 8, apiOrigin: PREVIEW_ORIGIN };

export function uuidSequence() {
  let next = 0;
  return () => `00000000-0000-4000-8000-${String(++next).padStart(12, "0")}`;
}

export function createClock(start = "2026-11-08T12:00:00.000Z") {
  let time = Date.parse(start);
  const timers: Array<{ at: number; callback: () => void; cancelled: boolean }> = [];

  return {
    now: () => time,
    advance(ms: number) {
      time += ms;
    },
    setTimer(callback: () => void, delayMs: number) {
      const timer = { at: time + delayMs, callback, cancelled: false };
      timers.push(timer);
      return () => {
        timer.cancelled = true;
      };
    },
    pendingTimers() {
      return timers
        .filter((timer) => !timer.cancelled)
        .map((timer) => timer.at - time);
    },
    /** Runs every live timer that is due now. */
    runDueTimers() {
      for (const timer of timers.splice(0)) {
        if (timer.cancelled) continue;
        if (timer.at <= time) timer.callback();
        else timers.push(timer);
      }
    }
  };
}

/** In-memory filesystem with an operation log for durability assertions. */
export function createMemoryFileSystem() {
  const files = new Map<string, string>();
  const log: string[] = [];
  const key = (path: readonly string[]) => path.join("/");

  const fileSystem: OutboxFileSystem = {
    async list(directory) {
      const prefix = `${key(directory)}/`;
      return [...files.keys()]
        .filter((name) => name.startsWith(prefix) && !name.slice(prefix.length).includes("/"))
        .map((name) => name.slice(prefix.length));
    },
    async read(path) {
      return files.get(key(path)) ?? null;
    },
    async write(path, contents) {
      log.push(`write ${key(path)}`);
      files.set(key(path), contents);
    },
    async move(from, to) {
      const contents = files.get(key(from));
      if (contents === undefined) throw new Error(`missing ${key(from)}`);
      log.push(`move ${key(from)} -> ${key(to)}`);
      files.delete(key(from));
      files.set(key(to), contents);
    },
    async remove(path) {
      log.push(`remove ${key(path)}`);
      files.delete(key(path));
    }
  };

  return { fileSystem, files, log };
}

type StoredEntry = {
  id: string;
  brewId: string;
  userId: number;
  body: Record<string, unknown>;
};

export type ServerFault =
  | { kind: "offline" }
  | { kind: "lose-response" }
  | { kind: "status"; status: number; body?: unknown }
  | { kind: "invalid-response" }
  | { kind: "hold"; release: Promise<void> };

/**
 * A fake MeadTools server implementing the brew-entry idempotency contract:
 * the client UUID becomes the entry ID, a same-owner retry returns the brew
 * normally, and reuse for another brew or owner returns 409.
 */
export function createFakeServer() {
  const tokens = new Map([
    ["token-a", 7],
    ["token-b", 8]
  ]);
  const brewOwners = new Map([
    ["brew-a", 7],
    ["brew-a2", 7],
    ["brew-b", 8]
  ]);
  const entries = new Map<string, StoredEntry>();
  const stages = new Map<string, string>();
  const stageOf = (brewId: string) => stages.get(brewId) ?? "PRIMARY";
  const faults: ServerFault[] = [];
  const requests: Array<{ brewId: string; token: string | null; body: string }> = [];

  function json(status: number, body: unknown): ApiResponse {
    return { ok: status >= 200 && status < 300, status, json: async () => body };
  }

  function brewResponse(brewId: string, userId: number) {
    const brewEntries = [...entries.values()]
      .filter((entry) => entry.brewId === brewId)
      .map((entry) => ({
        id: entry.id,
        datetime: entry.body.datetime,
        type: entry.body.type,
        title: entry.body.title ?? null,
        note: entry.body.note ?? null,
        gravity: entry.body.gravity ?? null,
        temperature: null,
        temp_units: null,
        data: entry.body.data ?? null,
        user_id: userId
      }));
    return {
      id: brewId,
      name: "Test brew",
      start_date: "2026-11-01T12:00:00.000Z",
      end_date: null,
      stage: stageOf(brewId),
      batch_number: 1,
      current_volume_liters: 18.9,
      requested_email_alerts: false,
      gravity_unit_preference: "SG",
      public: false,
      recipe_id: null,
      recipe_name: null,
      recipe_private: null,
      entry_count: brewEntries.length,
      latest_gravity: null,
      cover_image_id: null,
      recipe_snapshot: null,
      entries: brewEntries,
      entries_by_stage: [{ stage: stageOf(brewId), entries: brewEntries }]
    };
  }

  function commit(brewId: string, userId: number, body: Record<string, unknown>) {
    const id = String(body.client_entry_id);
    const existing = entries.get(id);
    if (body.type === "STAGE_CHANGE") {
      // Mirrors the server: replay by UUID, then refuse a stale expected stage.
      if (existing) {
        return existing.brewId === brewId && existing.userId === userId && existing.body.type === "STAGE_CHANGE"
          ? json(201, { brew: brewResponse(brewId, userId) })
          : json(409, { error: "Entry ID is already in use" });
      }
      if (body.expected_stage !== undefined && body.expected_stage !== stageOf(brewId)) {
        return json(409, { error: "Brew stage changed", code: "STAGE_CONFLICT", current_stage: stageOf(brewId) });
      }
      entries.set(id, {
        id, brewId, userId,
        body: { ...body, data: { from: stageOf(brewId), to: body.stage_to } }
      });
      stages.set(brewId, String(body.stage_to));
      return json(201, { brew: brewResponse(brewId, userId) });
    }
    if (existing && (existing.brewId !== brewId || existing.userId !== userId)) {
      return json(409, { error: "Entry ID is already in use" });
    }
    if (!existing) entries.set(id, { id, brewId, userId, body });
    return json(201, { brew: brewResponse(brewId, userId) });
  }

  async function fetch(url: string, init: ApiRequestInit): Promise<ApiResponse> {
    const match = /\/api\/brews\/([^/]+)\/entries$/.exec(url);
    if (!match || init.method !== "POST") throw new Error(`Unexpected ${init.method} ${url}`);
    const brewId = decodeURIComponent(match[1]);
    const token = init.headers.authorization?.replace(/^Bearer /, "") ?? null;
    requests.push({ brewId, token, body: init.body ?? "" });

    const fault = faults.shift();
    if (fault?.kind === "offline") throw new TypeError("Network request failed");
    if (fault?.kind === "status") return json(fault.status, fault.body ?? { error: "Failure" });
    if (fault?.kind === "hold") await fault.release;

    const userId = token ? tokens.get(token) : undefined;
    if (userId === undefined) return json(401, { error: "Invalid or expired token" });
    if (brewOwners.get(brewId) !== userId) return json(404, { error: "Brew not found" });

    const response = commit(brewId, userId, JSON.parse(init.body ?? "{}"));
    if (fault?.kind === "lose-response") throw new TypeError("Network request failed");
    if (fault?.kind === "invalid-response") return json(201, { unexpected: true });
    return response;
  }

  const send: SendBrewEntry = ({ brewId, request, accessToken }) =>
    createMeadToolsApiClient({
      baseUrl: PREVIEW_ORIGIN,
      fetch,
      getAccessToken: () => accessToken
    }).createBrewEntry(brewId, request);

  return {
    entries,
    stages,
    faults,
    requests,
    send,
    brew: (brewId: string) => brewResponse(brewId, brewOwners.get(brewId) ?? 0)
  };
}

export function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

export async function flush(times = 20) {
  for (let index = 0; index < times; index += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
}

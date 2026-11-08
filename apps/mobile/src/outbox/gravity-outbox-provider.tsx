import { useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import {
  createContext,
  type PropsWithChildren,
  use,
  useCallback,
  useEffect,
  useMemo,
  useSyncExternalStore
} from "react";
import { AppState, Platform } from "react-native";

import type { BrewResponse } from "@meadtools/api-contract";

import { createMobileApiClient } from "@/api/client";
import { apiBaseUrl } from "@/config/api";
import { useSession } from "@/providers/app-providers";

import { withDevOutboxFault } from "./dev-fault-injection";
import { createExpoOutboxFileSystem } from "./expo-outbox-file-system";
import { createGravityOutbox, type GravityOutbox } from "./gravity-outbox";
import {
  normalizeApiOrigin,
  type GravityOutboxRecord
} from "./gravity-outbox-record";
import { createFileOutboxStore, type GravityOutboxStore } from "./gravity-outbox-store";

const GravityOutboxContext = createContext<GravityOutbox | null>(null);

let sharedStore: GravityOutboxStore | null = null;
function outboxStore() {
  sharedStore ??= createFileOutboxStore(createExpoOutboxFileSystem());
  return sharedStore;
}

function isBrewResponse(value: unknown): value is BrewResponse {
  return (
    !!value &&
    typeof value === "object" &&
    Array.isArray((value as { entries?: unknown }).entries)
  );
}

/**
 * Owns the signed-in account's gravity outbox. The outbox is recreated when
 * the account changes, so another account's queue is never loaded, shown or
 * uploaded. Unsent records stay on the device for their own account.
 */
export function GravityOutboxProvider({ children }: PropsWithChildren) {
  const { session, getAccessTokenForUser } = useSession();
  const queryClient = useQueryClient();
  const userId = session?.id ?? null;

  // One outbox per signed-in account. Creating it has no side effects;
  // delivery starts and stops with the effect below.
  const outbox = useMemo(() => {
    // The web export has no durable file store; the outbox is native-only.
    if (userId === null || Platform.OS === "web") return null;

    // Mutable per-outbox auth recovery state, shared by the callbacks below.
    const auth = { forceRefresh: false, recoveryAttempted: false };
    const engine = createGravityOutbox({
      account: { userId, apiOrigin: normalizeApiOrigin(apiBaseUrl) },
      store: outboxStore(),
      async getAccessToken(account) {
        const token = await getAccessTokenForUser(account.userId, {
          forceRefresh: auth.forceRefresh
        });
        auth.forceRefresh = false;
        return token;
      },
      send: ({ brewId, request, accessToken }) =>
        withDevOutboxFault(() =>
          createMobileApiClient(() => accessToken).createBrewEntry(brewId, request)
        ),
      randomUUID: Crypto.randomUUID,
      onSynchronized(record, brew) {
        auth.recoveryAttempted = false;
        queryClient.setQueryData(["brew", userId, record.brewId], brew);
        void queryClient.invalidateQueries({ queryKey: ["brews", userId] });
      },
      onAuthRejected() {
        // The server rejected an unexpired token: refresh once and replay.
        // A second rejection waits for the same account to sign in again.
        if (auth.recoveryAttempted) return;
        auth.recoveryAttempted = true;
        auth.forceRefresh = true;
        void engine.replay("session");
      }
    });
    return engine;
  }, [getAccessTokenForUser, queryClient, userId]);

  useEffect(() => {
    if (!outbox || userId === null) return;
    const engine = outbox;

    engine.start();
    void engine.replay("session");

    const appState = AppState.addEventListener("change", (state) => {
      if (state === "active") void engine.replay("resume");
    });

    // A successful server read means connectivity is back. Reconcile that
    // brew's timeline first so a lost acknowledgement retires without
    // another upload, then replay anything still unsent.
    const unsubscribeCache = queryClient.getQueryCache().subscribe((event) => {
      if (
        event.type !== "updated" ||
        event.action.type !== "success" ||
        event.action.manual
      ) {
        return;
      }
      const [scope, owner, brewId] = event.query.queryKey as unknown[];
      if (owner !== userId) return;

      const data: unknown = event.query.state.data;
      const reconciled =
        scope === "brew" && typeof brewId === "string" && isBrewResponse(data)
          ? engine.acknowledgeServerEntries(
              brewId,
              data.entries.map((entry) => entry.id)
            )
          : Promise.resolve();

      void reconciled
        .catch(() => undefined)
        .then(() => {
          if (engine.hasDeliverableWork()) void engine.replay("reconnect");
        });
    });

    return () => {
      appState.remove();
      unsubscribeCache();
      engine.dispose();
    };
  }, [outbox, queryClient, userId]);

  return <GravityOutboxContext value={outbox}>{children}</GravityOutboxContext>;
}

/** The signed-in account's outbox, or null while signed out. */
export function useGravityOutbox() {
  return use(GravityOutboxContext);
}

const EMPTY: readonly GravityOutboxRecord[] = [];
const noopSubscribe = () => () => undefined;

/** Outbox records for one brew, oldest first, for timeline rendering. */
export function useGravityOutboxRecords(brewId: string | undefined) {
  const outbox = useGravityOutbox();
  const subscribe = useCallback(
    (listener: () => void) => outbox?.subscribe(listener) ?? noopSubscribe(),
    [outbox]
  );
  const getSnapshot = useCallback(
    () => outbox?.getSnapshot() ?? EMPTY,
    [outbox]
  );
  const all = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    void outbox?.load().catch(() => undefined);
  }, [outbox]);

  return useMemo(
    () => (brewId ? all.filter((record) => record.brewId === brewId) : EMPTY),
    [all, brewId]
  );
}

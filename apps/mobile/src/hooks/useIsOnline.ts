import * as Network from "expo-network";

import { isOnline } from "@/outbox/entry-outbox-provider";

/**
 * Whether the device reports a usable connection. Online-only actions
 * (editing, deleting and stock deductions) are disabled while this is false.
 * Unknown states count as online so a slow first read never blocks the user;
 * the request itself still reports a failure.
 */
export function useIsOnline() {
  const state = Network.useNetworkState();
  return state.isConnected === undefined ? true : isOnline(state);
}

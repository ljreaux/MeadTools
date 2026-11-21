import { MeadToolsApiError, MeadToolsContractError } from "@meadtools/api-client";

/**
 * Whether a request failed before the server answered (offline, DNS, TLS,
 * aborted or timed out). `expo/fetch` reports these as its own `FetchError`,
 * not `TypeError`, so anything that is not an API or contract error counts,
 * as in the entry outbox.
 */
export function isConnectionError(error: unknown): boolean {
  return (
    error instanceof Error &&
    !(error instanceof MeadToolsApiError) &&
    !(error instanceof MeadToolsContractError)
  );
}

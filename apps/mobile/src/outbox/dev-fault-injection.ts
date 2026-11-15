/**
 * Development-only failure injection for outbox verification (#446). The
 * iOS Simulator has no network conditioner, and the shared/local backend must
 * not be disrupted, so failures are injected around the upload instead.
 * Release builds always send normally.
 */
export type DevOutboxFault = "none" | "offline" | "lose-response";

let currentFault: DevOutboxFault = "none";
const listeners = new Set<() => void>();

export function getDevOutboxFault() {
  return currentFault;
}

export function setDevOutboxFault(fault: DevOutboxFault) {
  currentFault = __DEV__ ? fault : "none";
  for (const listener of listeners) listener();
}

export function subscribeDevOutboxFault(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * "offline" fails before the request is sent (until turned off).
 * "lose-response" lets the server commit, then reports a transport failure
 * once, simulating a lost acknowledgement.
 */
export async function withDevOutboxFault<T>(send: () => Promise<T>): Promise<T> {
  if (!__DEV__ || currentFault === "none") return send();
  if (currentFault === "offline") {
    throw new TypeError("Simulated offline (development fault injection)");
  }
  await send();
  setDevOutboxFault("none");
  throw new TypeError("Simulated lost response (development fault injection)");
}

/**
 * The request never got an answer from the server (offline, DNS, refused,
 * TLS, aborted or timed out). The Mobile fetch transport throws this for
 * every `expo/fetch` failure; code errors and server answers never are one.
 * Extends TypeError, the standard fetch failure type, for older checks.
 */
export class ConnectionError extends TypeError {
  constructor(cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause));
    this.name = "ConnectionError";
    this.cause = cause;
  }
}

export function isConnectionError(error: unknown): boolean {
  return error instanceof ConnectionError;
}

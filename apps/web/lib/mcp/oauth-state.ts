export function isAllowedMcpOAuthState(state: string) {
  return state.length >= 8 && state.length <= 2_048;
}

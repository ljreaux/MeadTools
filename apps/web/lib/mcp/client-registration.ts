import { isAllowedMcpRedirect } from "./redirect-uri";

const MAX_REDIRECT_URIS = 16;

export function parseMcpClientRegistration(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;

  const metadata = input as Record<string, unknown>;
  const name = typeof metadata.client_name === "string"
    ? metadata.client_name.trim() : "MCP client";
  const uris = metadata.redirect_uris;
  if (
    name.length < 1 || name.length > 100 ||
    !Array.isArray(uris) || uris.length < 1 || uris.length > MAX_REDIRECT_URIS ||
    !uris.every((uri) => typeof uri === "string" && isAllowedMcpRedirect(uri))
  ) return null;
  if (
    metadata.token_endpoint_auth_method !== undefined && metadata.token_endpoint_auth_method !== "none"
  ) return null;
  if (
    metadata.grant_types !== undefined &&
    (!Array.isArray(metadata.grant_types) ||
      metadata.grant_types.some((grant) => grant !== "authorization_code" && grant !== "refresh_token"))
  ) return null;

  return { name, uris: uris as string[] };
}

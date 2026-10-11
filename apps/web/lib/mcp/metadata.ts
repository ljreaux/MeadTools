import "server-only";

export const MCP_SCOPE = "mcp:tools";

export function mcpOrigin() {
  // A PR Preview has a unique public origin. Its OAuth issuer, resource, and
  // callback start must all stay on that exact deployment, even when the
  // shared Preview environment has a different NEXT_PUBLIC_BASE_URL.
  if (process.env.VERCEL_ENV === "preview" && process.env.VERCEL_URL) {
    const host = process.env.VERCEL_URL;
    if (!/^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.vercel\.app$/i.test(host)) {
      throw new Error("Invalid Vercel Preview URL for MCP.");
    }
    return `https://${host}`;
  }
  const configured = process.env.NEXT_PUBLIC_BASE_URL?.trim();
  if (!configured || !URL.canParse(configured)) {
    throw new Error("MCP base URL is not configured.");
  }
  const url = new URL(configured);
  if (
    url.protocol !== "https:" &&
    !(process.env.NODE_ENV !== "production" && url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))
  ) {
    throw new Error("MCP base URL must be HTTPS outside local development.");
  }
  return url.origin;
}

export function mcpResource() {
  return `${mcpOrigin()}/mcp`;
}

export function protectedResourceMetadataUrl() {
  return `${mcpOrigin()}/.well-known/oauth-protected-resource`;
}

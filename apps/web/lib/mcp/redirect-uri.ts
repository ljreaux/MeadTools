export function isAllowedMcpRedirect(uri: string) {
  if (uri.length > 2_048 || !URL.canParse(uri)) return false;
  const url = new URL(uri);
  if (uri.includes("#") || url.username || url.password) return false;

  if (url.protocol === "https:") return Boolean(url.hostname);

  return url.protocol === "http:" &&
    ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
}

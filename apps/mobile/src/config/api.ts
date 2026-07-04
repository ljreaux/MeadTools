const DEFAULT_API_BASE_URL = "https://meadtools.com";

export function resolveApiBaseUrl(
  configuredUrl = process.env.EXPO_PUBLIC_MEADTOOLS_API_URL
) {
  const candidate = configuredUrl?.trim() || DEFAULT_API_BASE_URL;
  const url = new URL(candidate);

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("MeadTools API URL must use HTTP or HTTPS");
  }

  return url.toString().replace(/\/+$/, "");
}

export const apiBaseUrl = resolveApiBaseUrl();

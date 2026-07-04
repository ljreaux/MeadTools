const DEFAULT_API_BASE_URL = "https://meadtools.com";

export function resolveApiBaseUrl(
  configuredUrl = process.env.EXPO_PUBLIC_MEADTOOLS_API_URL,
  platform = process.env.EXPO_OS
) {
  const candidate = configuredUrl?.trim() || DEFAULT_API_BASE_URL;
  const url = new URL(candidate);

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("MeadTools API URL must use HTTP or HTTPS");
  }

  if (platform === "android" && url.hostname === "localhost") {
    url.hostname = "10.0.2.2";
  }

  return url.toString().replace(/\/+$/, "");
}

export const apiBaseUrl = resolveApiBaseUrl();

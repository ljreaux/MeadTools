import {
  createMeadToolsApiClient,
  type FetchTransport
} from "@meadtools/api-client";
import { fetch as expoFetch } from "expo/fetch";

import { apiBaseUrl } from "@/config/api";

const nativeFetch: FetchTransport = async (url, init) => {
  const response = await expoFetch(url, init);

  return {
    ok: response.ok,
    status: response.status,
    json: () => response.json()
  };
};

export function createMobileApiClient(
  getAccessToken?: () => string | null | undefined
) {
  return createMeadToolsApiClient({
    baseUrl: apiBaseUrl,
    fetch: nativeFetch,
    getAccessToken
  });
}

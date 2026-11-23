import {
  createMeadToolsApiClient,
  type FetchTransport
} from "@meadtools/api-client";
import { fetch as expoFetch } from "expo/fetch";

import { apiBaseUrl } from "@/config/api";

import { ConnectionError } from "./errors";

const nativeFetch: FetchTransport = async (url, init) => {
  let response: Awaited<ReturnType<typeof expoFetch>>;
  try {
    response = await expoFetch(url, init);
  } catch (error) {
    throw new ConnectionError(error);
  }

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

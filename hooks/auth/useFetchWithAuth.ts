"use client";

import { useCallback } from "react";
import { useAuthToken } from "./useAuthToken";

export function useFetchWithAuth() {
  const token = useAuthToken();

  const fetchWithAuth = useCallback(
    async function fetchWithAuth<T>(
      url: string,
      init?: RequestInit
    ): Promise<T> {
      if (!token) {
        const err: any = new Error("You must be logged in.");
        err.code = "NO_TOKEN";
        throw err;
      }

      const response = await fetch(url, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          ...(init?.headers || {}),
          Authorization: `Bearer ${token}`
        }
      });

      const json = await response.json().catch(() => null);

      if (!response.ok) {
        const err: any = new Error(json?.error || `HTTP ${response.status}`);
        err.status = response.status;
        err.body = json;
        throw err;
      }

      return json as T;
    },
    [token]
  );

  return fetchWithAuth;
}

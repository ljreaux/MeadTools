// lib/useFetchWithAuth.ts
"use client";
import { useAuthToken } from "./useAuthToken";

export function useFetchWithAuth() {
  const token = useAuthToken();

  return async function fetchWithAuth<T>(
    url: string,
    init?: RequestInit
  ): Promise<T> {
    if (!token) {
      const err: any = new Error("You must be logged in.");
      err.code = "NO_TOKEN"; // 👈 tag it so callers can special-case
      throw err;
    }

    const r = await fetch(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers || {}),
        Authorization: `Bearer ${token}`
      }
    });

    const json = await r.json().catch(() => null);

    if (!r.ok) {
      const err: any = new Error(json?.error || `HTTP ${r.status}`);
      err.status = r.status; // 👈 keep status for callers like RecipePage
      err.body = json;
      throw err;
    }

    return json as T;
  };
}

"use client";
import { useAuthToken } from "./useAuthToken";

export function useFetchWithAuth() {
  const token = useAuthToken();

  return async function fetchWithAuth<T>(
    url: string,
    init?: RequestInit
  ): Promise<T> {
    if (!token) throw new Error("You must be logged in.");
    const r = await fetch(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers || {}),
        Authorization: `Bearer ${token}`
      }
    });
    const json = await r.json().catch(() => null);
    if (!r.ok) throw new Error(json?.error || `HTTP ${r.status}`);
    return json as T;
  };
}

"use client";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";

/** Returns the best-available bearer token or null (reactive to session/localStorage). */
export function useAuthToken() {
  const { data: session } = useSession();
  // Credentials login writes the legacy bearer token to localStorage. Read it
  // for the initial browser render so authenticated API queries do not make a
  // doomed unauthenticated request before the effect below can synchronize.
  const [token, setToken] = useState<string | null>(() =>
    typeof window !== "undefined" ? localStorage.getItem("accessToken") : null,
  );

  useEffect(() => {
    const local =
      typeof window !== "undefined"
        ? localStorage.getItem("accessToken")
        : null;
    const nextAuthToken =
      (session as any)?.accessToken || // if you expose accessToken via callbacks
      (session?.user as any)?.id || // your fallback used elsewhere
      null;

    setToken(local ?? nextAuthToken ?? null);
  }, [session]);

  return token;
}

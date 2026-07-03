"use client";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";

/** Returns the best-available bearer token or null (reactive to session/localStorage). */
export function useAuthToken() {
  const { data: session } = useSession();
  const [token, setToken] = useState<string | null>(null);

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

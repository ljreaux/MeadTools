"use client";

import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { fetchAccountInfo, type AuthUser } from "@/lib/api/auth";
import { qk } from "@/lib/db/queryKeys";

export function useAuth() {
  const { data: session, status } = useSession();

  const accessToken =
    typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;

  const nextAuthAccessToken = (session as any)?.accessToken ?? null;

  const enabled = !!accessToken || status === "authenticated";

  const {
    data: user,
    isLoading: isUserLoading,
    isFetching,
    isError,
    error
  } = useQuery<AuthUser | null>({
    // Credential login populates localStorage after the first client render.
    // Keep auth query results separated by credential availability without
    // putting the bearer value itself into the client query cache.
    queryKey: [
      ...qk.authMe,
      accessToken ? "bearer" : nextAuthAccessToken ? "session" : "anonymous"
    ] as const,
    queryFn: () => fetchAccountInfo(accessToken, nextAuthAccessToken),
    enabled,
    staleTime: 5 * 60 * 1000,
    retry: false
  });

  const loading =
    status === "loading" || (enabled && (isUserLoading || isFetching));

  const isLoggedIn = !!user;

  return {
    user: user ?? null,
    isLoggedIn,
    loading,
    isError,
    error
  };
}

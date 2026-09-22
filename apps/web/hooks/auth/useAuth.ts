"use client";

import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";
import { fetchAccountInfo, type AuthUser } from "@/lib/api/auth";
import {
  getStoredAccessToken,
  subscribeToStoredAccessToken,
} from "@/lib/auth/client-token";
import { qk } from "@/lib/db/queryKeys";

const HYDRATING_ACCESS_TOKEN = "__meadtools_hydrating_access_token__";

export function useAuth() {
  const { data: session, status } = useSession();
  const accessTokenSnapshot = useSyncExternalStore(
    subscribeToStoredAccessToken,
    getStoredAccessToken,
    () => HYDRATING_ACCESS_TOKEN,
  );
  const hasHydratedCredentialState =
    accessTokenSnapshot !== HYDRATING_ACCESS_TOKEN;
  const accessToken = hasHydratedCredentialState ? accessTokenSnapshot : null;

  const nextAuthAccessToken = (session as any)?.accessToken ?? null;

  const enabled =
    hasHydratedCredentialState &&
    (!!accessToken || status === "authenticated");

  const {
    data: user,
    isLoading: isUserLoading,
    isFetching,
    isError,
    error,
  } = useQuery<AuthUser | null>({
    // Credential login populates localStorage after the first client render.
    // Keep auth query results separated by credential availability without
    // putting the bearer value itself into the client query cache.
    queryKey: [
      ...qk.authMe,
      accessToken ? "bearer" : nextAuthAccessToken ? "session" : "anonymous",
    ] as const,
    queryFn: () => fetchAccountInfo(accessToken, nextAuthAccessToken),
    enabled,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const loading =
    !hasHydratedCredentialState ||
    status === "loading" ||
    (enabled && (isUserLoading || isFetching));

  const isLoggedIn = !!user;

  return {
    user: user ?? null,
    isLoggedIn,
    loading,
    isError,
    error,
  };
}

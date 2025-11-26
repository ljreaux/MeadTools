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
    queryKey: qk.authMe,
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

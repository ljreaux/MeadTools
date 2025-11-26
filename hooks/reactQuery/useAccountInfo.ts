"use client";

import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { fetchFullAccountInfo, type AccountInfo } from "@/lib/api/auth";
import { qk } from "@/lib/db/queryKeys";

export function useAccountInfo() {
  const { data: session, status } = useSession();

  const accessToken =
    typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;

  const nextAuthAccessToken = (session as any)?.accessToken ?? null;

  const enabled = !!accessToken || status === "authenticated";

  const query = useQuery<AccountInfo>({
    queryKey: qk.accountInfo,
    queryFn: () => fetchFullAccountInfo(accessToken, nextAuthAccessToken),
    enabled,
    staleTime: 5 * 60 * 1000,
    retry: false
  });

  return query;
}

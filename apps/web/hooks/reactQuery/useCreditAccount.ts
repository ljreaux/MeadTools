"use client";

import type { CreditActivityResponse } from "@meadtools/api-contract/contracts";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useAuthToken } from "@/hooks/auth/useAuthToken";
import { qk } from "@/lib/db/queryKeys";

export type CreditActivityPage = CreditActivityResponse;

function headersFor(token: string | null) {
  return token ? { Authorization: `Bearer ${token}` } : undefined;
}

export async function fetchCreditActivityPage(options: {
  token: string | null;
  cursor?: string | null;
  limit?: number;
}): Promise<CreditActivityPage> {
  const searchParams = new URLSearchParams({ limit: String(options.limit ?? 20) });
  if (options.cursor) searchParams.set("cursor", options.cursor);

  const response = await fetch(`/api/account/credits/history?${searchParams}`, {
    headers: headersFor(options.token)
  });
  const payload = (await response.json().catch(() => null)) as CreditActivityPage | {
    error?: string;
  } | null;
  if (!response.ok || !payload || !("activities" in payload)) {
    throw new Error(payload && "error" in payload ? payload.error : "Unable to load credit activity.");
  }
  return payload;
}

/** The signed-in user's immutable credit balance and newest activity page. */
export function useCreditAccount() {
  const token = useAuthToken();
  const { status } = useSession();
  const enabled = Boolean(token) || status === "authenticated";

  return useQuery({
    queryKey: qk.creditAccount,
    queryFn: () => fetchCreditActivityPage({ token }),
    enabled,
    staleTime: 30_000,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    retry: false
  });
}

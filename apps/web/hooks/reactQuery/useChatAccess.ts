"use client";

import type { ChatAccessStatusResponse } from "@meadtools/api-contract/contracts";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useAuthToken } from "@/hooks/auth/useAuthToken";
import { qk } from "@/lib/db/queryKeys";

function headersFor(token: string | null) {
  return token ? { Authorization: `Bearer ${token}` } : undefined;
}

async function fetchChatAccess(token: string | null): Promise<ChatAccessStatusResponse> {
  const response = await fetch("/api/chat/access", { headers: headersFor(token) });
  const payload = (await response.json().catch(() => null)) as ChatAccessStatusResponse | { error?: string } | null;
  if (!response.ok || !payload || !("chatEnabled" in payload)) {
    throw new Error(payload && "error" in payload ? payload.error : "Unable to load chat access.");
  }
  return payload;
}

/** The current signed-in user's server-enforced recipe-chat entitlement. */
export function useChatAccess() {
  const token = useAuthToken();
  const { status } = useSession();
  const enabled = Boolean(token) || status === "authenticated";

  return useQuery({
    queryKey: qk.chatAccess,
    queryFn: () => fetchChatAccess(token),
    enabled,
    staleTime: 5_000,
    retry: false
  });
}

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
    // `useAuthToken` reads localStorage after hydration. Keep the token value
    // out of React Query's cache key, but distinguish that hydrated state from
    // the initial session-only request so a transient 401 cannot strand a
    // freshly signed-in brewer on the chat loading screen.
    queryKey: [...qk.chatAccess, token ? "bearer" : "session"] as const,
    queryFn: () => fetchChatAccess(token),
    enabled,
    staleTime: 5_000,
    retry: false
  });
}

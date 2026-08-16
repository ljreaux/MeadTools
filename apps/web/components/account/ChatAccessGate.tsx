"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import ChatWorkspace from "@/components/account/ChatWorkspace";
import Loading from "@/components/loading";
import { useChatAccess } from "@/hooks/reactQuery/useChatAccess";

/** Keeps direct account chat and credit URLs private to chat-entitled users. */
export default function ChatAccessGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { data, isLoading } = useChatAccess();

  useEffect(() => {
    if (!isLoading && data && !data.chatEnabled && !data.paymentRestricted)
      router.replace("/account");
  }, [data, isLoading, router]);

  if (isLoading) return <Loading />;
  if (data?.paymentRestricted) return <ChatWorkspace paymentRestricted />;
  if (!data?.chatEnabled) return <Loading />;
  return <>{children}</>;
}

"use client";

import type {
  ChatAccessAdministrationResponse,
  ChatAccessMode,
  CreditPaymentRecoveryAdministrationResponse,
  CreateChatAccessGrantResponse,
  CreateChatCreditGrantResponse,
  DeleteChatAccessGrantResponse,
  ResolveCreditPaymentRecoveryResponse,
} from "@meadtools/api-contract/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useFetchWithAuth } from "@/hooks/auth/useFetchWithAuth";
import { qk } from "@/lib/db/queryKeys";

export function useAdminChatAccess() {
  const fetchWithAuth = useFetchWithAuth();
  return useQuery({
    queryKey: qk.adminChatAccess,
    queryFn: () =>
      fetchWithAuth<ChatAccessAdministrationResponse>("/api/admin/chat-access"),
    staleTime: 30_000,
  });
}

export function useUpdateAdminChatAccessMode() {
  const fetchWithAuth = useFetchWithAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (mode: ChatAccessMode) =>
      fetchWithAuth<ChatAccessAdministrationResponse>(
        "/api/admin/chat-access",
        {
          method: "PATCH",
          body: JSON.stringify({ mode }),
        },
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: qk.adminChatAccess }),
  });
}

export function useGrantAdminChatAccess() {
  const fetchWithAuth = useFetchWithAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: number) =>
      fetchWithAuth<CreateChatAccessGrantResponse>(
        "/api/admin/chat-access/grants",
        {
          method: "POST",
          body: JSON.stringify({ userId }),
        },
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: qk.adminChatAccess }),
  });
}

export function useGrantAdminChatCredits() {
  const fetchWithAuth = useFetchWithAuth();
  return useMutation({
    mutationFn: ({
      userId,
      creditAmount,
    }: {
      userId: number;
      creditAmount: number;
    }) =>
      fetchWithAuth<CreateChatCreditGrantResponse>(
        "/api/admin/chat-access/credits",
        {
          method: "POST",
          body: JSON.stringify({ userId, creditAmount }),
        },
      ),
  });
}

export function useRevokeAdminChatAccess() {
  const fetchWithAuth = useFetchWithAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: number) =>
      fetchWithAuth<DeleteChatAccessGrantResponse>(
        `/api/admin/chat-access/grants/${userId}`,
        {
          method: "DELETE",
        },
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: qk.adminChatAccess }),
  });
}

export function useAdminChatPaymentRecoveries() {
  const fetchWithAuth = useFetchWithAuth();
  return useQuery({
    queryKey: qk.adminChatPaymentRecoveries,
    queryFn: () =>
      fetchWithAuth<CreditPaymentRecoveryAdministrationResponse>(
        "/api/admin/chat-access/payment-recoveries",
      ),
    staleTime: 30_000,
  });
}

export function useResolveAdminChatPaymentRecovery() {
  const fetchWithAuth = useFetchWithAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      recoveryId,
      creditDelta,
      note,
      releaseChat,
    }: {
      recoveryId: string;
      creditDelta: number;
      note: string;
      releaseChat: boolean;
    }) =>
      fetchWithAuth<ResolveCreditPaymentRecoveryResponse>(
        `/api/admin/chat-access/payment-recoveries/${recoveryId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ creditDelta, note, releaseChat }),
        },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: qk.adminChatPaymentRecoveries,
      });
      queryClient.invalidateQueries({ queryKey: qk.adminChatAccess });
    },
  });
}

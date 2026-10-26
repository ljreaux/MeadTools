"use client";
import { useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/auth/useAuth";
import { useAuthToken } from "@/hooks/auth/useAuthToken";
import {
  finishedMeadOverviewResponseSchema, finishedMeadHistoryResponseSchema, finishedMeadMutationResponseSchema,
} from "@meadtools/api-contract/inventory";
import type { CreateFinishedMeadRequestBody, UpdateFinishedMeadRequestBody } from "@meadtools/api-contract/contracts";
import { InventoryRequestError } from "./useInventory";

type WithoutOperation<T> = T extends unknown ? Omit<T, "operation_id"> : never;
export type FinishedMeadCommand = { mead: CreateFinishedMeadRequestBody["mead"] } |
  { id: string; change: WithoutOperation<UpdateFinishedMeadRequestBody> };
function useMeadRequest() {
  const token = useAuthToken();
  return async (path = "", init?: RequestInit) => {
    const response = await fetch(`/api/account/inventory/meads${path}`, { ...init, cache: "no-store", headers: {
      "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}),
    } });
    const body = await response.json();
    if (!response.ok) throw new InventoryRequestError(body.code ?? "FAILED");
    return body;
  };
}
export function useFinishedMeads() {
  const { user } = useAuth();
  const request = useMeadRequest();
  const client = useQueryClient();
  const queryKey = ["account", "finished-meads", user?.id] as const;
  const operation = useRef<{ signature: string; id: string } | null>(null);
  const overview = useQuery({ queryKey, enabled: Boolean(user), retry: false,
    queryFn: async () => finishedMeadOverviewResponseSchema.parse(await request()) });
  const mutation = useMutation({ mutationFn: async (command: FinishedMeadCommand) => {
    const signature = JSON.stringify(command);
    if (operation.current?.signature !== signature) operation.current = { signature, id: crypto.randomUUID() };
    return finishedMeadMutationResponseSchema.parse(await request("id" in command ? `/${command.id}` : "", {
      method: "id" in command ? "PATCH" : "POST",
      body: JSON.stringify({ ...("mead" in command ? command : command.change), operation_id: operation.current.id }),
    }));
  }, onSuccess: async () => {
    operation.current = null;
    await Promise.all([client.invalidateQueries({ queryKey }), client.invalidateQueries({ queryKey: ["account", "inventory-organization"] })]);
  } });
  return { overview, mutation };
}
export function useFinishedMeadHistory(id: string) {
  const { user } = useAuth();
  const request = useMeadRequest();
  return useQuery({ queryKey: ["account", "finished-meads", user?.id, "history", id], enabled: Boolean(user), retry: false,
    queryFn: async () => finishedMeadHistoryResponseSchema.parse(await request(`/${id}`)) });
}

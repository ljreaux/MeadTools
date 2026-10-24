"use client";

import { useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/auth/useAuth";
import { useAuthToken } from "@/hooks/auth/useAuthToken";
import { inventoryOverviewResponseSchema, inventoryStockHistoryResponseSchema, inventoryStockMutationResponseSchema } from "@meadtools/api-contract/inventory";
import type { CreateInventoryStockRequestBody, UpdateInventoryStockRequestBody } from "@meadtools/api-contract/contracts";

type WithoutOperation<T> = T extends unknown ? Omit<T, "operation_id"> : never;
export type InventoryCommand = { stock: CreateInventoryStockRequestBody["stock"] } |
  { id: string; change: WithoutOperation<UpdateInventoryStockRequestBody> };
export class InventoryRequestError extends Error {
  constructor(readonly code: string) { super(code); }
}
function useInventoryRequest() {
  const token = useAuthToken();
  return async (path = "", init?: RequestInit) => {
    const response = await fetch(`/api/account/inventory${path}`, { ...init, cache: "no-store", headers: {
      "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}),
    } });
    const body = await response.json();
    if (!response.ok) throw new InventoryRequestError(body.code ?? "FAILED");
    return body;
  };
}
export function useInventory() {
  const { user } = useAuth();
  const request = useInventoryRequest();
  const client = useQueryClient();
  const queryKey = ["account", "inventory", user?.id] as const;
  const operation = useRef<{ signature: string; id: string } | null>(null);
  const overview = useQuery({ queryKey, enabled: Boolean(user), retry: false,
    queryFn: async () => inventoryOverviewResponseSchema.parse(await request()) });
  const mutation = useMutation({ mutationFn: async (command: InventoryCommand) => {
    const signature = JSON.stringify(command);
    if (operation.current?.signature !== signature) operation.current = { signature, id: crypto.randomUUID() };
    const body = "stock" in command ? command : command.change;
    return inventoryStockMutationResponseSchema.parse(await request("id" in command ? `/${command.id}` : "", {
      method: "id" in command ? "PATCH" : "POST",
      body: JSON.stringify({ ...body, operation_id: operation.current.id }),
    }));
  }, onSuccess: async () => {
    operation.current = null;
    await client.invalidateQueries({ queryKey });
  } });
  return { overview, mutation };
}
export function useInventoryHistory(id: string) {
  const { user } = useAuth();
  const request = useInventoryRequest();
  return useQuery({ queryKey: ["account", "inventory", user?.id, "history", id], enabled: Boolean(user), retry: false,
    queryFn: async () => inventoryStockHistoryResponseSchema.parse(await request(`/${id}`)) });
}

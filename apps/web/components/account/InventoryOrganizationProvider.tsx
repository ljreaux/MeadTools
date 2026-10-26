"use client";
import { createContext, useContext, useRef, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/auth/useAuth";
import { useAuthToken } from "@/hooks/auth/useAuthToken";
import {
  inventoryOrganizationResponseSchema,
  inventoryOrganizationMutationResponseSchema,
  inventoryStorageHistoryResponseSchema,
} from "@meadtools/api-contract/inventory";
import type {
  UpdateInventoryOrganizationRequestBody,
  UpdateInventoryStorageRequestBody,
  InventoryOrganizationResponse,
} from "@meadtools/api-contract/contracts";
import { InventoryRequestError } from "@/hooks/reactQuery/useInventory";

type WithoutOperation<T> = T extends unknown ? Omit<T, "operation_id"> : never;
export type OrganizationCommand =
  | { change: WithoutOperation<UpdateInventoryOrganizationRequestBody> }
  | {
      stock_id: string;
      storage: WithoutOperation<UpdateInventoryStorageRequestBody>;
    };
function useOrganizationRequest() {
  const token = useAuthToken();
  return async (path: string, init?: RequestInit) => {
    const response = await fetch(`/api/account/inventory/${path}`, {
      ...init,
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    const body = await response.json();
    if (!response.ok) throw new InventoryRequestError(body.code ?? "FAILED");
    return body;
  };
}
function useOrganizationState() {
  const { user } = useAuth();
  const request = useOrganizationRequest();
  const client = useQueryClient();
  const operation = useRef<{ signature: string; id: string } | null>(null);
  const overview = useQuery({
    queryKey: ["account", "inventory-organization", user?.id],
    enabled: Boolean(user),
    retry: false,
    queryFn: async () =>
      inventoryOrganizationResponseSchema.parse(await request("organization")),
  });
  const mutation = useMutation({
    mutationFn: async (command: OrganizationCommand) => {
      const signature = JSON.stringify(command);
      if (operation.current?.signature !== signature)
        operation.current = { signature, id: crypto.randomUUID() };
      return inventoryOrganizationMutationResponseSchema.parse(
        await request(
          "storage" in command ? `storage/${command.stock_id}` : "organization",
          {
            method: "PATCH",
            body: JSON.stringify({
              ...("storage" in command ? command.storage : command.change),
              operation_id: operation.current.id,
            }),
          },
        ),
      );
    },
    onSuccess: async () => {
      operation.current = null;
      await Promise.all(
        [
          "inventory-organization",
          "inventory",
          "finished-meads",
          "brew-inventory",
        ].map((key) =>
          client.invalidateQueries({ queryKey: ["account", key] }),
        ),
      );
    },
  });
  return { overview, mutation };
}
const Context = createContext<ReturnType<typeof useOrganizationState> | null>(
  null,
);
export function InventoryOrganizationProvider({
  children,
}: {
  children: ReactNode;
}) {
  const value = useOrganizationState();
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useInventoryOrganization() {
  const value = useContext(Context);
  if (!value) throw new Error("Inventory organization provider is required");
  return value;
}
export function useStorageHistory(stockId: string) {
  const { user } = useAuth();
  const request = useOrganizationRequest();
  return useQuery({
    queryKey: [
      "account",
      "inventory-organization",
      user?.id,
      "history",
      stockId,
    ],
    enabled: Boolean(user),
    retry: false,
    queryFn: async () =>
      inventoryStorageHistoryResponseSchema.parse(
        await request(`storage/${stockId}`),
      ),
  });
}
export function targetLabels(
  data: InventoryOrganizationResponse | undefined,
  kind: "stock" | "mead",
  id: string,
) {
  return (
    data?.assignments.find((row) => row.kind === kind && row.id === id)
      ?.label_ids ?? []
  );
}

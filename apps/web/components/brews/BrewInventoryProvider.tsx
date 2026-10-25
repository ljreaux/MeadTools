"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/auth/useAuth";
import { useAuthToken } from "@/hooks/auth/useAuthToken";
import {
  brewInventoryContextResponseSchema,
  inventoryOverviewResponseSchema,
} from "@meadtools/api-contract/inventory";
import { equipmentOverviewResponseSchema } from "@meadtools/api-contract/equipment";
import type {
  BrewInventoryContextResponse,
  BrewInventorySelection,
  EquipmentOverviewResponse,
  InventoryStockItem,
} from "@meadtools/api-contract/contracts";
import {
  tryInventoryEntryLines,
  matchInventoryStock,
  resolveCatalogReferences,
  nutrientCatalog,
  stabilizerCatalog,
  type InventoryLine,
} from "@meadtools/inventory-domain";

import {
  BrewInventoryBatchDialog,
  type InventoryBatch,
} from "./BrewInventoryBatchDialog";
import { BrewInventoryCancelled } from "@/lib/brews/inventorySelection";
import type { CreateBrewEntryInput } from "@/hooks/reactQuery/useAccountBrews";
import { useIngredientsQuery } from "@/hooks/reactQuery/useIngredientsQuery";
import { useYeastsQuery } from "@/hooks/reactQuery/useYeastsQuery";
import { useAdditivesQuery } from "@/hooks/reactQuery/useAdditivesQuery";
export type BrewStockIntent = {
  brewId: string;
  entryId: string;
  operationId: string;
  kind: "create" | "edit" | "remove";
  entryType?: string;
  data?: unknown;
  retrySelection?: BrewInventorySelection;
  selection?: BrewInventorySelection;
};
export type BrewStockUsage = BrewInventoryContextResponse["usages"][number];
export class BrewInventoryRequestError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}
type InventoryContext = {
  canManage: boolean;
  trackedEntryIds: string[];
  resolveLines: (lines: InventoryLine[]) => InventoryLine[];
  reviewBatch: (
    entries: CreateBrewEntryInput[],
    save: InventoryBatch["save"],
  ) => Promise<void>;
  events: BrewInventoryContextResponse["vessel_events"];
  usages: BrewStockUsage[];
  stock: InventoryStockItem[];
  stockLoading: boolean;
  stockError: boolean;
  equipment?: EquipmentOverviewResponse;
  equipmentLoading: boolean;
  equipmentError: boolean;
  refreshEquipment: () => void;
  refreshInventory: () => Promise<BrewInventoryContextResponse>;
  run: <T>(
    intent: BrewStockIntent,
    execute: (selection?: BrewInventorySelection) => Promise<T>,
  ) => Promise<T>;
};
const Context = createContext<InventoryContext | null>(null);
export const useBrewInventory = () => useContext(Context);
export function BrewInventoryProvider({ children }: { children: ReactNode }) {
  const [batch, setBatch] = useState<InventoryBatch | null>(null);
  const { brew_id: brewId } = useParams<{ brew_id: string }>();
  const { user } = useAuth();
  const token = useAuthToken();
  const ingredients = useIngredientsQuery();
  const yeasts = useYeastsQuery();
  const additives = useAdditivesQuery();
  const catalog = [
    ...(ingredients.data ?? []).map((item) => ({
      name: item.name,
      reference: { catalog: "ingredient" as const, id: String(item.id) },
    })),
    ...(yeasts.data ?? []).map((item) => ({
      name: `${item.brand} ${item.name}`,
      reference: { catalog: "yeast" as const, id: String(item.id) },
    })),
    ...(additives.data ?? []).map((item) => ({
      name: item.name,
      reference: { catalog: "additive" as const, id: String(item.id) },
    })),
    ...nutrientCatalog.map((item) => ({
      name: item.name,
      reference: { catalog: "nutrient" as const, id: item.id },
    })),
    ...stabilizerCatalog.map((item) => ({
      name: item.name,
      reference: { catalog: "additive" as const, id: item.id },
    })),
  ];
  const contextKey = ["account", "brew-inventory", user?.id, brewId] as const;
  const equipmentKey = ["account", "equipment", user?.id] as const;
  async function request(path: string, init?: RequestInit) {
    const response = await fetch(path, {
      ...init,
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    const body = await response.json();
    if (!response.ok)
      throw new BrewInventoryRequestError(body.code ?? "FAILED");
    return body;
  }
  const context = useQuery({
    queryKey: contextKey,
    enabled: Boolean(user && brewId),
    retry: false,
    queryFn: async () =>
      brewInventoryContextResponseSchema.parse(
        await request(`/api/brews/${brewId}/inventory`),
      ),
  });
  const canManage = context.data?.can_manage === true;
  const equipment = useQuery({
    queryKey: equipmentKey,
    enabled: canManage,
    retry: false,
    queryFn: async () =>
      equipmentOverviewResponseSchema.parse(
        await request("/api/account/equipment"),
      ),
  });
  const stock = useQuery({
    queryKey: ["account", "inventory", user?.id],
    enabled: canManage,
    retry: false,
    queryFn: async () =>
      inventoryOverviewResponseSchema.parse(
        await request("/api/account/inventory"),
      ),
  });
  async function run<T>(
    intent: BrewStockIntent,
    execute: (selection?: BrewInventorySelection) => Promise<T>,
  ) {
    if (!canManage) return execute();
    if (intent.retrySelection) return execute(intent.retrySelection);
    const previous =
      context.data?.usages.filter((use) => use.entry_id === intent.entryId) ??
      [];
    if (
      intent.kind !== "create" &&
      !previous.length &&
      !context.data?.tracked_entry_ids.includes(intent.entryId)
    )
      return execute();
    if (intent.kind === "edit" && intent.data === undefined) return execute();
    if (intent.selection)
      return execute(
        intent.selection.mode === "untracked"
          ? intent.selection
          : { ...intent.selection, operation_id: intent.operationId },
      );
    // Interactive entry forms supply their reviewed choices. Other entry types do not infer physical use.
    if (intent.kind === "create") return execute();
    const lines =
      intent.kind === "remove"
        ? []
        : tryInventoryEntryLines(intent.entryType ?? "ADDITION", intent.data);
    return execute({
      mode: "items",
      operation_id: intent.operationId,
      expected: previous.map(({ line_key, stock_id, deducted }) => ({
        line_key,
        stock_id,
        deducted,
      })),
      items: lines.map((line) => ({
        line_key: line.key,
        stock_id:
          previous.find((use) => use.line_key === line.key)?.stock_id ??
          matchInventoryStock(stock.data?.stock ?? [], line).stock?.id ??
          null,
      })),
    });
  }
  return (
    <Context.Provider
      value={{
        canManage,
        resolveLines: (lines) => resolveCatalogReferences(lines, catalog),
        trackedEntryIds: context.data?.tracked_entry_ids ?? [],
        reviewBatch: async (entries, save) => {
          if (!canManage) return save(entries, "");
          return new Promise<void>((resolve, reject) =>
            setBatch({
              entries: entries.map((entry) => ({
                ...entry,
                client_entry_id: crypto.randomUUID(),
              })),
              operationId: crypto.randomUUID(),
              save,
              resolve,
              reject,
            }),
          );
        },
        events: context.data?.vessel_events ?? [],
        usages: context.data?.usages ?? [],
        stock: stock.data?.stock ?? [],
        stockLoading: stock.isPending,
        stockError: stock.isError,
        equipment: equipment.data,
        equipmentLoading: equipment.isPending,
        equipmentError: equipment.isError,
        refreshEquipment: () => {
          void equipment.refetch();
        },
        refreshInventory: async () => {
          const [fresh] = await Promise.all([
            context.refetch({ throwOnError: true }),
            stock.refetch({ throwOnError: true }),
          ]);
          if (!fresh.data) throw new BrewInventoryRequestError("FAILED");
          return fresh.data;
        },
        run,
      }}
    >
      {children}
      {batch ? (
        <BrewInventoryBatchDialog
          batch={batch}
          onClose={() => {
            batch.reject(new BrewInventoryCancelled());
            setBatch(null);
          }}
        />
      ) : null}
    </Context.Provider>
  );
}

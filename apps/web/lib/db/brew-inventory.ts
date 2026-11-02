import { tryInventoryEntryLines } from "@meadtools/inventory-domain";
import "server-only";
import type { PrismaClient } from "@prisma/client";
import { InventoryError } from "@meadtools/inventory-domain";
import type { BrewInventoryContextResponse } from "@meadtools/api-contract/contracts";
import prisma from "@/lib/prisma";
import { getPremiumAccessStatus } from "./premium-access";
import { stockItem } from "./inventory-account";

export async function readBrewInventory(
  userId: number,
  brewId: string,
  database: PrismaClient = prisma,
): Promise<BrewInventoryContextResponse> {
  const status = await getPremiumAccessStatus(userId, new Date(), database);
  const brew = await database.brews.findFirst({
    where: { id: brewId, user_id: userId },
    select: { id: true },
  });
  if (!status.activeUser || !brew) throw new InventoryError("NOT_FOUND");
  if (!status.premiumEnabled)
    return {
      can_manage: false,
      tracked_entry_ids: [],
      usages: [],
      vessel_events: [],
    };
  const [usages, operations] = await Promise.all([
    database.inventory_consumptions.findMany({
      where: { user_id: userId, brew_id: brewId },
      include: { stock: true },
    }),
    database.equipment_assignment_events.findMany({
      where: {
        user_id: userId,
        OR: [{ from_brew_id: brewId }, { to_brew_id: brewId }],
      },
      select: { operation_key: true },
      distinct: ["operation_key"],
      orderBy: [{ created_at: "desc" }, { id: "desc" }],
      take: 50,
    }),
  ]);
  // Fetch whole operations before grouping, so pagination cannot turn a
  // 100-container assignment into a misleading partial quantity.
  const events = operations.length
    ? await database.equipment_assignment_events.findMany({
        where: {
          user_id: userId,
          operation_key: {
            in: operations.map((operation) => operation.operation_key),
          },
          OR: [{ from_brew_id: brewId }, { to_brew_id: brewId }],
        },
        include: {
          equipment: { select: { name: true, label: true, group_id: true } },
        },
        orderBy: [{ created_at: "desc" }, { id: "desc" }],
      })
    : [];
  const entries = await database.brew_entries.findMany({
    where: {
      brew_id: brewId,
      user_id: userId,
      id: { in: usages.map((use) => use.entry_id) },
    },
    select: { id: true, type: true, data: true },
  });
  return {
    can_manage: true,
    tracked_entry_ids: Array.from(
      new Set(usages.map((usage) => usage.entry_id)),
    ),
    usages: usages
      .filter((usage) => !usage.reversed_at)
      .map((usage) => ({
        entry_id: usage.entry_id,
        line_key: usage.line_key,
        line_name: (() => {
          const entry = entries.find((entry) => entry.id === usage.entry_id);
          return entry
            ? (tryInventoryEntryLines(entry.type, entry.data).find(
                (line) => line.key === usage.line_key,
              )?.name ?? "")
            : "";
        })(),
        stock_id: usage.stock_id,
        deducted: { value: usage.deducted.toNumber(), unit: usage.unit },
        stock: stockItem(usage.stock),
        stock_archived: usage.stock.archived_at !== null,
      })),
    vessel_events: Array.from(
      events
        .reduce((groups, event) => {
          const action =
            event.to_brew_id === brewId
              ? ("assigned" as const)
              : ("released" as const);
          const key = `${event.operation_key}:${event.equipment.group_id}:${event.equipment.label ?? ""}:${action}`;
          const previous = groups.get(key);
          if (previous) previous.quantity++;
          else
            groups.set(key, {
              id: event.id,
              equipment_name: [event.equipment.name, event.equipment.label]
                .filter(Boolean)
                .join(" · "),
              quantity: 1,
              action,
              created_at: event.created_at.toISOString(),
            });
          return groups;
        }, new Map<string, BrewInventoryContextResponse["vessel_events"][number]>())
        .values(),
    ).slice(0, 50),
  };
}

import "server-only";
import type { PrismaClient } from "@prisma/client";
import {
  InventoryError,
  inventoryLocationPaths,
} from "@meadtools/inventory-domain";
import {
  updateInventoryOrganizationRequestBodySchema,
  updateInventoryStorageRequestBodySchema,
  inventoryOrganizationMutationResponseSchema,
} from "@meadtools/api-contract/inventory";
import prisma from "@/lib/prisma";
import { createInventoryOperation, InventoryWriteError } from "./inventory";
import { getPremiumAccessStatus } from "./premium-access";
import {
  organizedStock,
  ownedStorageStock,
  replaceStorage,
} from "./inventory-storage";

export function createInventoryOrganizationService(
  database: PrismaClient = prisma,
) {
  const operation = createInventoryOperation(database);
  async function access(userId: number) {
    const status = await getPremiumAccessStatus(userId, new Date(), database);
    if (!status.activeUser) throw new InventoryError("NOT_FOUND");
    return status;
  }
  async function overview(userId: number) {
    const status = await access(userId);
    return database.$transaction(
      async (tx) => {
        const [labels, locations, stock, links] = await Promise.all([
          tx.inventory_labels.findMany({
            where: { user_id: userId, archived_at: null },
            orderBy: { name: "asc" },
          }),
          tx.inventory_locations.findMany({
            where: { user_id: userId, archived_at: null },
          }),
          tx.inventory_stock.findMany({
            where: { user_id: userId, archived_at: null },
            include: { allocations: true },
          }),
          tx.inventory_label_links.findMany({
            where: { user_id: userId, label: { archived_at: null } },
          }),
        ]);
        const paths = inventoryLocationPaths(locations);
        const assignments = new Map<
          string,
          { kind: "stock" | "mead"; id: string; label_ids: string[] }
        >();
        for (const link of links) {
          const kind = link.mead_id ? "mead" : "stock",
            id = (link.mead_id ?? link.stock_id)!;
          const key = `${kind}:${id}`;
          if (!assignments.has(key))
            assignments.set(key, { kind, id, label_ids: [] });
          assignments.get(key)!.label_ids.push(link.label_id);
        }
        return {
          can_manage: status.premiumEnabled,
          labels: labels.map(({ id, name, version }) => ({
            id,
            name,
            version,
          })),
          locations: locations
            .map(({ id, name, parent_id, version }) => ({
              id,
              name,
              parent_id,
              version,
              path: paths.get(id)!,
            }))
            .sort((a, b) => a.path.localeCompare(b.path)),
          stock: stock.map(organizedStock),
          assignments: [...assignments.values()],
        };
      },
      { isolationLevel: "RepeatableRead" },
    );
  }
  const normalized = (name: string) =>
    name.normalize("NFKC").trim().toLocaleLowerCase();
  async function mutate(userId: number, input: unknown) {
    const parsed = updateInventoryOrganizationRequestBodySchema.parse(input);
    return operation(
      userId,
      parsed.operation_id,
      JSON.parse(
        JSON.stringify({ kind: "inventory_organization", input: parsed }),
      ),
      (value) => inventoryOrganizationMutationResponseSchema.parse(value),
      async (tx) => {
        if (parsed.action === "assign_labels") {
          const where =
            parsed.kind === "stock"
              ? { stock_id: parsed.id }
              : { mead_id: parsed.id };
          const target =
            parsed.kind === "stock"
              ? await tx.inventory_stock.findFirst({
                  where: {
                    id: parsed.id,
                    user_id: userId,
                    archived_at: null,
                    mead_id: null,
                  },
                })
              : await tx.inventory_meads.findFirst({
                  where: { id: parsed.id, user_id: userId, archived_at: null },
                });
          if (!target) throw new InventoryError("NOT_FOUND");
          const labels = await tx.inventory_labels.findMany({
            where: { user_id: userId, archived_at: null },
          });
          const ids = [...new Set(parsed.label_ids)];
          if (
            ids.length !== parsed.label_ids.length ||
            ids.some((id) => !labels.some((label) => label.id === id))
          )
            throw new InventoryError("NOT_FOUND");
          const previous = await tx.inventory_label_links.findMany({
            where: { user_id: userId, ...where, label: { archived_at: null } },
          });
          if (
            JSON.stringify(previous.map((link) => link.label_id).sort()) !==
            JSON.stringify([...parsed.expected_label_ids].sort())
          )
            throw new InventoryWriteError("ORGANIZATION_CHANGED");
          await tx.inventory_label_links.deleteMany({
            where: { user_id: userId, ...where },
          });
          if (ids.length)
            await tx.inventory_label_links.createMany({
              data: ids.map((label_id) => ({
                user_id: userId,
                label_id,
                ...where,
              })),
            });
          return { id: parsed.id };
        }
        const isLocation = parsed.action.endsWith("location");
        if (isLocation) {
          const locations = await tx.inventory_locations.findMany({
            where: { user_id: userId, archived_at: null },
          });
          const existing =
            "id" in parsed
              ? locations.find((row) => row.id === parsed.id)
              : null;
          if ("id" in parsed && !existing)
            throw new InventoryError("NOT_FOUND");
          if (
            existing &&
            "expected_version" in parsed &&
            existing.version !== parsed.expected_version
          )
            throw new InventoryWriteError("ORGANIZATION_CHANGED");
          if (parsed.action === "archive_location") {
            if (
              locations.some((row) => row.parent_id === parsed.id) ||
              (await tx.inventory_allocations.count({
                where: { user_id: userId, location_id: parsed.id },
              }))
            )
              throw new InventoryWriteError("STORAGE_IN_USE");
            await tx.inventory_locations.update({
              where: { id: parsed.id },
              data: { archived_at: new Date(), version: { increment: 1 } },
            });
            return { id: parsed.id };
          }
          if (
            parsed.action !== "create_location" &&
            parsed.action !== "edit_location"
          )
            throw new InventoryError("LINK_MISMATCH");
          if (
            parsed.parent_id &&
            !locations.some((row) => row.id === parsed.parent_id)
          )
            throw new InventoryError("NOT_FOUND");
          if (
            locations.some(
              (row) =>
                row.id !== existing?.id &&
                row.parent_id === parsed.parent_id &&
                normalized(row.name) === normalized(parsed.name),
            )
          )
            throw new InventoryError("LINK_MISMATCH");
          const id = existing?.id ?? crypto.randomUUID();
          const proposed = [
            ...locations.filter((row) => row.id !== id),
            { id, name: parsed.name, parent_id: parsed.parent_id },
          ];
          if (
            [...inventoryLocationPaths(proposed).values()].some(
              (path) => path.length > 5000,
            )
          )
            throw new InventoryError("INVALID_QUANTITY");
          if (existing)
            await tx.inventory_locations.update({
              where: { id },
              data: {
                name: parsed.name,
                parent_id: parsed.parent_id,
                version: { increment: 1 },
              },
            });
          else
            await tx.inventory_locations.create({
              data: {
                id,
                user_id: userId,
                name: parsed.name,
                parent_id: parsed.parent_id,
              },
            });
          return { id };
        }
        const labels = await tx.inventory_labels.findMany({
          where: { user_id: userId, archived_at: null },
        });
        const existing =
          "id" in parsed ? labels.find((row) => row.id === parsed.id) : null;
        if ("id" in parsed && !existing) throw new InventoryError("NOT_FOUND");
        if (
          existing &&
          "expected_version" in parsed &&
          existing.version !== parsed.expected_version
        )
          throw new InventoryWriteError("ORGANIZATION_CHANGED");
        if (parsed.action === "archive_label") {
          await tx.inventory_labels.update({
            where: { id: parsed.id },
            data: { archived_at: new Date(), version: { increment: 1 } },
          });
          return { id: parsed.id };
        }
        if (parsed.action !== "create_label" && parsed.action !== "edit_label")
          throw new InventoryError("LINK_MISMATCH");
        if (
          labels.some(
            (row) =>
              row.id !== existing?.id &&
              normalized(row.name) === normalized(parsed.name),
          )
        )
          throw new InventoryError("LINK_MISMATCH");
        const label = existing
          ? await tx.inventory_labels.update({
              where: { id: existing.id },
              data: { name: parsed.name, version: { increment: 1 } },
            })
          : await tx.inventory_labels.create({
              data: { user_id: userId, name: parsed.name },
            });
        return { id: label.id };
      },
    );
  }
  async function setStorage(userId: number, stockId: string, input: unknown) {
    const parsed = updateInventoryStorageRequestBodySchema.parse(input);
    return operation(
      userId,
      parsed.operation_id,
      { kind: "inventory_storage", stockId, input: parsed },
      (value) => inventoryOrganizationMutationResponseSchema.parse(value),
      async (tx, operationId) => {
        const stock = await ownedStorageStock(tx, userId, stockId);
        if (stock.archived_at) throw new InventoryWriteError("STOCK_ARCHIVED");
        if (organizedStock(stock).revision !== parsed.expected_revision)
          throw new InventoryWriteError("STALE_STOCK");
        await replaceStorage(
          tx,
          userId,
          operationId,
          stock,
          parsed.allocations,
        );
        return { id: stockId };
      },
    );
  }
  async function storageHistory(userId: number, stockId: string) {
    await access(userId);
    if (
      !(await database.inventory_stock.findFirst({
        where: { id: stockId, user_id: userId },
      }))
    )
      throw new InventoryError("NOT_FOUND");
    const rows = await database.inventory_storage_events.findMany({
      where: { user_id: userId, stock_id: stockId },
      orderBy: [{ created_at: "desc" }, { id: "desc" }],
      take: 101,
    });
    return {
      has_more: rows.length > 100,
      changes: rows.slice(0, 100).map((row) => ({
        id: row.id,
        operation_id: row.operation_id,
        location_path: row.location_path,
        position: row.position,
        delta: row.delta.toNumber(),
        balance_after: row.balance_after.toNumber(),
        unit: row.unit,
        reason: row.reason,
        created_at: row.created_at.toISOString(),
      })),
    };
  }
  return { overview, mutate, setStorage, storageHistory };
}

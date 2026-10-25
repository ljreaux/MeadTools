import "server-only";

import { randomUUID } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { z } from "zod";
import {
  InventoryError,
  planVesselAssignment,
} from "@meadtools/inventory-domain";
import {
  createEquipmentRequestBodySchema,
  updateEquipmentRequestBodySchema,
  equipmentMutationResponseSchema,
  equipmentItemSchema,
} from "@meadtools/api-contract/equipment";
import type {
  EquipmentItem,
  EquipmentMutationResponse,
  EquipmentOverviewResponse,
} from "@meadtools/api-contract/contracts";
import prisma from "@/lib/prisma";
import { createInventoryOperation } from "./inventory";
import { getPremiumAccessStatus } from "./premium-access";

const include = {
  brew: {
    select: { id: true, name: true, recipes: { select: { name: true } } },
  },
} as const;
function item(
  row: Prisma.equipmentGetPayload<{ include: typeof include }>,
): EquipmentItem {
  return equipmentItemSchema.parse({
    id: row.id,
    group_id: row.group_id,
    label: row.label,
    name: row.name,
    type: row.type,
    notes: row.notes,
    capacity:
      row.capacity !== null && row.capacity_unit
        ? { value: row.capacity.toNumber(), unit: row.capacity_unit }
        : null,
    brew: row.brew
      ? {
          id: row.brew.id,
          name: row.brew.name,
          recipe_name: row.brew.recipes?.name ?? null,
        }
      : null,
  });
}
export class EquipmentAssignmentChangedError extends Error {
  readonly code = "ASSIGNMENT_CHANGED";
}

export function createEquipmentService(database: PrismaClient = prisma) {
  const operation = createInventoryOperation(database);

  async function overview(userId: number): Promise<EquipmentOverviewResponse> {
    const status = await getPremiumAccessStatus(userId, new Date(), database);
    if (!status.activeUser) throw new InventoryError("NOT_FOUND");
    const [equipment, brews] = await Promise.all([
      database.equipment.findMany({
        where: { user_id: userId, archived_at: null },
        include,
        orderBy: [{ type: "desc" }, { name: "asc" }, { id: "asc" }],
      }),
      database.brews.findMany({
        where: { user_id: userId, stage: { not: "COMPLETE" }, end_date: null },
        select: { id: true, name: true, recipes: { select: { name: true } } },
        orderBy: { start_date: "desc" },
      }),
    ]);
    return {
      can_manage: status.premiumEnabled,
      equipment: equipment.map(item),
      brews: brews.map((brew) => ({
        id: brew.id,
        name: brew.name,
        recipe_name: brew.recipes?.name ?? null,
      })),
    };
  }

  async function create(
    userId: number,
    input: z.input<typeof createEquipmentRequestBodySchema>,
  ): Promise<EquipmentMutationResponse> {
    const parsed = createEquipmentRequestBodySchema.parse(input);
    return operation(
      userId,
      parsed.operation_id,
      { kind: "create_equipment", input: parsed },
      (result) => equipmentMutationResponseSchema.parse(result),
      async (tx) => {
        const value = parsed.equipment;
        const groupId = randomUUID();
        const units = [];
        for (let i = 0; i < parsed.quantity; i++)
          units.push(
            await tx.equipment.create({
              data: {
                group_id: groupId,
                user_id: userId,
                name: value.name,
                type: value.type,
                notes: value.notes,
                capacity: value.capacity?.value ?? null,
                capacity_unit: value.capacity?.unit ?? null,
              },
              include,
            }),
          );
        return { equipment: item(units[0]) };
      },
    );
  }

  async function update(
    userId: number,
    id: string,
    input: z.input<typeof updateEquipmentRequestBodySchema>,
  ): Promise<EquipmentMutationResponse> {
    z.string().uuid().parse(id);
    const parsed = updateEquipmentRequestBodySchema.parse(input);
    return operation(
      userId,
      parsed.operation_id,
      { kind: "update_equipment", id, input: parsed },
      (result) => equipmentMutationResponseSchema.parse(result),
      async (tx) => {
        // Lock the target brew before equipment to coordinate completion/deletion.
        let target: { id: string; ownerId: number; complete: boolean } | null =
          null;
        if (
          (parsed.action === "assign" || parsed.action === "allocate") &&
          parsed.brew_id
        ) {
          const brews = await tx.$queryRaw<
            Array<{ id: string; stage: string; end_date: Date | null }>
          >`
            SELECT id, stage, end_date FROM brews
            WHERE id = ${parsed.brew_id}::uuid AND user_id = ${userId} FOR UPDATE
          `;
          if (!brews.length) throw new InventoryError("NOT_FOUND");
          target = {
            id: brews[0].id,
            ownerId: userId,
            complete:
              brews[0].stage === "COMPLETE" || brews[0].end_date !== null,
          };
        }
        await tx.$queryRaw`
          SELECT id FROM equipment
          WHERE id = ${id}::uuid AND user_id = ${userId} AND archived_at IS NULL FOR UPDATE
        `;
        const row = await tx.equipment.findFirst({
          where: { id, user_id: userId, archived_at: null },
          include,
        });
        if (!row) throw new InventoryError("NOT_FOUND");
        if (parsed.action === "allocate") {
          if (target?.complete && parsed.quantity > 0)
            throw new InventoryError("BREW_COMPLETE");
          if (row.type !== "vessel") throw new InventoryError("NOT_A_VESSEL");
          const units = await tx.equipment.findMany({
            where: {
              user_id: userId,
              group_id: row.group_id,
              archived_at: null,
            },
            orderBy: [{ label: "asc" }, { id: "asc" }],
          });
          const current = units.filter(
            (unit) => unit.current_brew_id === parsed.brew_id,
          );
          if (
            JSON.stringify(current.map((unit) => unit.id).sort()) !==
            JSON.stringify([...parsed.expected_ids].sort())
          )
            throw new EquipmentAssignmentChangedError();
          const available = units
            .filter((unit) => !unit.current_brew_id)
            .sort(
              (a, b) => Number(Boolean(a.label)) - Number(Boolean(b.label)),
            );
          if (parsed.quantity > current.length + available.length)
            throw new InventoryError("VESSEL_OCCUPIED");
          const allCurrent = await tx.equipment.findMany({
            where: { user_id: userId, current_brew_id: parsed.brew_id },
            select: { id: true },
          });
          const kept = [...current, ...available]
            .slice(0, parsed.quantity)
            .map((unit) => unit.id);
          await replaceBrewContainers(
            tx,
            userId,
            parsed.brew_id,
            {
              expected_ids: allCurrent.map((unit) => unit.id),
              equipment_ids: [
                ...allCurrent
                  .filter(
                    (unit) => !units.some((member) => member.id === unit.id),
                  )
                  .map((unit) => unit.id),
                ...kept,
              ],
            },
            parsed.operation_id,
          );
        } else if (parsed.action === "label") {
          await tx.equipment.update({
            where: { id },
            data: { label: parsed.label || null },
          });
        } else if (parsed.action === "edit_group") {
          const units = await tx.equipment.findMany({
            where: {
              user_id: userId,
              group_id: row.group_id,
              archived_at: null,
            },
            orderBy: { id: "asc" },
          });
          const excess = units.length - parsed.quantity;
          const removable = units
            .filter((unit) => !unit.current_brew_id)
            .sort((a, b) =>
              Boolean(a.label) !== Boolean(b.label)
                ? Number(Boolean(a.label)) - Number(Boolean(b.label))
                : a.id === id
                  ? 1
                  : b.id === id
                    ? -1
                    : 0,
            );
          if (
            excess > removable.length ||
            (units.some((unit) => unit.current_brew_id) &&
              parsed.equipment.type !== "vessel")
          )
            throw new InventoryError("VESSEL_OCCUPIED");
          const value = parsed.equipment;
          const shared = {
            name: value.name,
            type: value.type,
            notes: value.notes,
            capacity: value.capacity?.value ?? null,
            capacity_unit: value.capacity?.unit ?? null,
          };
          await tx.equipment.updateMany({
            where: {
              user_id: userId,
              group_id: row.group_id,
              archived_at: null,
            },
            data: shared,
          });
          if (excess > 0)
            await tx.equipment.updateMany({
              where: {
                id: { in: removable.slice(0, excess).map((unit) => unit.id) },
              },
              data: { archived_at: new Date() },
            });
          for (let i = units.length; i < parsed.quantity; i++)
            await tx.equipment.create({
              data: { ...shared, user_id: userId, group_id: row.group_id },
            });
        } else if (parsed.action === "assign") {
          if (row.current_brew_id !== parsed.expected_brew_id)
            throw new EquipmentAssignmentChangedError();
          const assignment = planVesselAssignment({
            ownerId: userId,
            equipment: {
              id,
              ownerId: userId,
              type: row.type,
              brewId: row.current_brew_id,
            },
            brew: target,
            reassign: parsed.reassign,
          });
          if (assignment.brewId !== row.current_brew_id) {
            await tx.equipment.update({
              where: { id },
              data: { current_brew_id: assignment.brewId },
            });
            await tx.equipment_assignment_events.create({
              data: {
                user_id: userId,
                equipment_id: id,
                operation_key: parsed.operation_id,
                from_brew_id: row.current_brew_id,
                to_brew_id: assignment.brewId,
              },
            });
          }
        } else if (parsed.action === "archive_group") {
          const occupied = await tx.equipment.count({
            where: {
              user_id: userId,
              group_id: row.group_id,
              archived_at: null,
              current_brew_id: { not: null },
            },
          });
          if (occupied) throw new InventoryError("VESSEL_OCCUPIED");
          await tx.equipment.updateMany({
            where: {
              user_id: userId,
              group_id: row.group_id,
              archived_at: null,
            },
            data: { archived_at: new Date() },
          });
        } else if (parsed.action === "archive") {
          if (row.current_brew_id) throw new InventoryError("VESSEL_OCCUPIED");
          await tx.equipment.update({
            where: { id },
            data: { archived_at: new Date() },
          });
        } else {
          if (
            parsed.equipment.type !== "vessel" &&
            (await tx.equipment.count({
              where: {
                user_id: userId,
                group_id: row.group_id,
                archived_at: null,
                current_brew_id: { not: null },
              },
            }))
          )
            throw new InventoryError("VESSEL_OCCUPIED");
          const value = parsed.equipment;
          await tx.equipment.updateMany({
            where: {
              user_id: userId,
              group_id: row.group_id,
              archived_at: null,
            },
            data: {
              name: value.name,
              type: value.type,
              notes: value.notes,
              capacity: value.capacity?.value ?? null,
              capacity_unit: value.capacity?.unit ?? null,
            },
          });
        }
        const updated =
          parsed.action === "edit_group"
            ? await tx.equipment.findFirstOrThrow({
                where: {
                  user_id: userId,
                  group_id: row.group_id,
                  archived_at: null,
                },
                include,
                orderBy: { id: "asc" },
              })
            : await tx.equipment.findUniqueOrThrow({ where: { id }, include });
        return { equipment: item(updated) };
      },
    );
  }
  return { overview, create, update };
}

/** Free brew lifecycle operations may release occupancy without a premium write. */
export async function releaseEquipmentForBrew(
  tx: Prisma.TransactionClient,
  userId: number,
  brewId: string,
) {
  const rows = await tx.equipment.findMany({
    where: { user_id: userId, current_brew_id: brewId },
    select: { id: true },
  });
  const operationKey = randomUUID();
  for (const row of rows) {
    const updated = await tx.equipment.updateMany({
      where: { id: row.id, user_id: userId, current_brew_id: brewId },
      data: { current_brew_id: null },
    });
    if (updated.count)
      await tx.equipment_assignment_events.create({
        data: {
          user_id: userId,
          equipment_id: row.id,
          operation_key: operationKey,
          from_brew_id: brewId,
        },
      });
  }
}

/** Replace this brew's allocation atomically; units occupied by another brew cannot be taken. */
export async function replaceBrewContainers(
  tx: Prisma.TransactionClient,
  userId: number,
  brewId: string,
  input: { expected_ids: string[]; equipment_ids: string[] },
  operationKey: string,
) {
  const existing = await tx.equipment.findMany({
    where: { user_id: userId, current_brew_id: brewId },
    select: { id: true },
  });
  const equal = (a: string[], b: string[]) =>
    JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
  if (
    !equal(
      existing.map((item) => item.id),
      input.expected_ids,
    )
  )
    throw new EquipmentAssignmentChangedError();
  const desired = await tx.equipment.findMany({
    where: {
      user_id: userId,
      id: { in: input.equipment_ids },
      archived_at: null,
      type: "vessel",
    },
  });
  if (desired.length !== new Set(input.equipment_ids).size)
    throw new InventoryError("NOT_FOUND");
  if (
    desired.some(
      (unit) => unit.current_brew_id && unit.current_brew_id !== brewId,
    )
  )
    throw new InventoryError("VESSEL_OCCUPIED");
  const ids = new Set(input.equipment_ids);
  for (const unit of existing)
    if (!ids.has(unit.id)) {
      await tx.equipment.update({
        where: { id: unit.id },
        data: { current_brew_id: null },
      });
      await tx.equipment_assignment_events.create({
        data: {
          user_id: userId,
          equipment_id: unit.id,
          operation_key: operationKey,
          from_brew_id: brewId,
        },
      });
    }
  for (const unit of desired)
    if (!unit.current_brew_id) {
      await tx.equipment.update({
        where: { id: unit.id },
        data: { current_brew_id: brewId },
      });
      await tx.equipment_assignment_events.create({
        data: {
          user_id: userId,
          equipment_id: unit.id,
          operation_key: operationKey,
          to_brew_id: brewId,
        },
      });
    }
}

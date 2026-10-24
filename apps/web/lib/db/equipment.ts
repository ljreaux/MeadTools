import "server-only";

import { randomUUID } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { z } from "zod";
import { InventoryError, planVesselAssignment } from "@meadtools/inventory-domain";
import {
  createEquipmentRequestBodySchema, updateEquipmentRequestBodySchema, equipmentMutationResponseSchema, equipmentItemSchema,
} from "@meadtools/api-contract/equipment";
import type { EquipmentItem, EquipmentMutationResponse, EquipmentOverviewResponse } from "@meadtools/api-contract/contracts";
import prisma from "@/lib/prisma";
import { createInventoryOperation } from "./inventory";
import { getPremiumAccessStatus } from "./premium-access";

const include = { brew: { select: { id: true, name: true, recipes: { select: { name: true } } } } } as const;
function item(row: Prisma.equipmentGetPayload<{ include: typeof include }>): EquipmentItem {
  return equipmentItemSchema.parse({
    id: row.id, name: row.name, type: row.type, notes: row.notes,
    capacity: row.capacity !== null && row.capacity_unit ? { value: row.capacity.toNumber(), unit: row.capacity_unit } : null,
    brew: row.brew ? { id: row.brew.id, name: row.brew.name, recipe_name: row.brew.recipes?.name ?? null } : null,
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
      database.equipment.findMany({ where: { user_id: userId, archived_at: null }, include, orderBy: [{ type: "desc" }, { name: "asc" }] }),
      database.brews.findMany({ where: { user_id: userId, stage: { not: "COMPLETE" }, end_date: null },
        select: { id: true, name: true, recipes: { select: { name: true } } }, orderBy: { start_date: "desc" } }),
    ]);
    return { can_manage: status.premiumEnabled, equipment: equipment.map(item),
      brews: brews.map((brew) => ({ id: brew.id, name: brew.name, recipe_name: brew.recipes?.name ?? null })) };
  }

  async function create(userId: number, input: z.input<typeof createEquipmentRequestBodySchema>): Promise<EquipmentMutationResponse> {
    const parsed = createEquipmentRequestBodySchema.parse(input);
    return operation(userId, parsed.operation_id, { kind: "create_equipment", input: parsed },
      (result) => equipmentMutationResponseSchema.parse(result), async (tx) => {
        const value = parsed.equipment;
        const equipment = await tx.equipment.create({ data: {
          user_id: userId, name: value.name, type: value.type, notes: value.notes,
          capacity: value.capacity?.value ?? null, capacity_unit: value.capacity?.unit ?? null,
        }, include });
        return { equipment: item(equipment) };
      });
  }

  async function update(userId: number, id: string, input: z.input<typeof updateEquipmentRequestBodySchema>): Promise<EquipmentMutationResponse> {
    z.string().uuid().parse(id);
    const parsed = updateEquipmentRequestBodySchema.parse(input);
    return operation(userId, parsed.operation_id, { kind: "update_equipment", id, input: parsed },
      (result) => equipmentMutationResponseSchema.parse(result), async (tx) => {
        // Lock the target brew before equipment to coordinate completion/deletion.
        let target: { id: string; ownerId: number; complete: boolean } | null = null;
        if (parsed.action === "assign" && parsed.brew_id) {
          const brews = await tx.$queryRaw<Array<{ id: string; stage: string; end_date: Date | null }>>`
            SELECT id, stage, end_date FROM brews
            WHERE id = ${parsed.brew_id}::uuid AND user_id = ${userId} FOR UPDATE
          `;
          if (!brews.length) throw new InventoryError("NOT_FOUND");
          target = { id: brews[0].id, ownerId: userId, complete: brews[0].stage === "COMPLETE" || brews[0].end_date !== null };
        }
        await tx.$queryRaw`
          SELECT id FROM equipment
          WHERE id = ${id}::uuid AND user_id = ${userId} AND archived_at IS NULL FOR UPDATE
        `;
        const row = await tx.equipment.findFirst({ where: { id, user_id: userId, archived_at: null }, include });
        if (!row) throw new InventoryError("NOT_FOUND");
        if (parsed.action === "assign") {
          if (row.current_brew_id !== parsed.expected_brew_id) throw new EquipmentAssignmentChangedError();
          const assignment = planVesselAssignment({ ownerId: userId,
            equipment: { id, ownerId: userId, type: row.type, brewId: row.current_brew_id },
            brew: target, reassign: parsed.reassign });
          if (assignment.brewId !== row.current_brew_id) {
            await tx.equipment.update({ where: { id }, data: { current_brew_id: assignment.brewId } });
            await tx.equipment_assignment_events.create({ data: {
              user_id: userId, equipment_id: id, operation_key: parsed.operation_id,
              from_brew_id: row.current_brew_id, to_brew_id: assignment.brewId,
            } });
          }
        } else if (parsed.action === "archive") {
          if (row.current_brew_id) throw new InventoryError("VESSEL_OCCUPIED");
          await tx.equipment.update({ where: { id }, data: { archived_at: new Date() } });
        } else {
          if (row.current_brew_id && parsed.equipment.type !== "vessel") throw new InventoryError("VESSEL_OCCUPIED");
          const value = parsed.equipment;
          await tx.equipment.update({ where: { id }, data: {
            name: value.name, type: value.type, notes: value.notes,
            capacity: value.capacity?.value ?? null, capacity_unit: value.capacity?.unit ?? null,
          } });
        }
        return { equipment: item(await tx.equipment.findUniqueOrThrow({ where: { id }, include })) };
      });
  }
  return { overview, create, update };
}

/** Free brew lifecycle operations may release occupancy without a premium write. */
export async function releaseEquipmentForBrew(tx: Prisma.TransactionClient, userId: number, brewId: string) {
  const rows = await tx.equipment.findMany({ where: { user_id: userId, current_brew_id: brewId }, select: { id: true } });
  const operationKey = randomUUID();
  for (const row of rows) {
    const updated = await tx.equipment.updateMany({
      where: { id: row.id, user_id: userId, current_brew_id: brewId }, data: { current_brew_id: null },
    });
    if (updated.count) await tx.equipment_assignment_events.create({ data: {
      user_id: userId, equipment_id: row.id, operation_key: operationKey, from_brew_id: brewId,
    } });
  }
}

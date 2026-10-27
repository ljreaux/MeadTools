import type { Prisma, PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { applyBottling } from "../lib/db/bottling";
/** Guarded by the main local seed. Attribute a few existing seed bottles without
 * receiving them twice; ordinary application writes still require entitlement. */
export async function seedBottlingProduction(
  database: PrismaClient,
  userId: number,
) {
  const stock = await database.inventory_stock.findFirst({
    where: { user_id: userId, category: "mead", quantity: { gte: 1 } },
    include: { mead: true },
  });
  if (!stock?.mead) return;
  const template = await database.brews.findFirst({
    where: { user_id: userId },
    orderBy: { start_date: "asc" },
  });
  await database.$transaction(async (tx) => {
    const brew = await tx.brews.create({
      data: {
        user_id: userId,
        name: "Inventory bottling example",
        stage: "PACKAGED",
        recipe_id: template?.recipe_id ?? null,
        ...(template?.recipe_snapshot
          ? {
              recipe_snapshot:
                template.recipe_snapshot as Prisma.InputJsonValue,
            }
          : {}),
      },
    });
    const entryId = randomUUID(),
      rowId = randomUUID(),
      quantity = Math.min(3, stock.quantity.toNumber());
    const data = {
      packagedVolumeLiters: quantity * stock.bottle_size_liters!.toNumber(),
      bottleRows: [
        {
          id: rowId,
          label: `${stock.bottle_size_liters!.toNumber() * 1000} mL`,
          quantity,
          sizeLiters: stock.bottle_size_liters!.toNumber(),
          totalLiters: quantity * stock.bottle_size_liters!.toNumber(),
        },
      ],
      closures: [],
    };
    const operation = await tx.inventory_operations.create({
      data: {
        user_id: userId,
        operation_key: randomUUID(),
        request_hash: "0".repeat(64),
        result: { kind: "seed_bottling" },
      },
    });
    await applyBottling(
      tx,
      userId,
      operation.id,
      {
        brewId: brew.id,
        entryId,
        kind: "create",
        entryMutation: { type: "PACKAGING", data },
      },
      {
        operation_id: operation.operation_key,
        expected_revision: null,
        mode: "reconcile",
        confirmed_on_hand: true,
        outputs: [
          {
            row_id: rowId,
            quantity,
            target: { kind: "existing", mead_id: stock.mead_id! },
            location_id: null,
            position: "",
          },
        ],
      },
      async (tx) => {
        await tx.brew_entries.create({
          data: {
            id: entryId,
            brew_id: brew.id,
            user_id: userId,
            type: "PACKAGING",
            data,
          },
        });
      },
    );
  });
}

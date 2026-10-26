import { createHash, randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { writeInventoryBalance } from "../lib/db/inventory";

/** Called by the guarded local seed; never changes existing entries. */
export async function seedFinishedMeads(database: PrismaClient, userId: number) {
  await database.$transaction(async (tx) => {
    const mead = await tx.inventory_meads.create({ data: {
      user_id: userId, name: "House traditional",
      notes: "Several bottlings kept together, with counts by bottle size.",
    } });
    const operation = await tx.inventory_operations.create({ data: {
      user_id: userId, operation_key: randomUUID(),
      request_hash: createHash("sha256").update(`seed_finished_mead:${mead.id}`).digest("hex"),
      result: { mead_id: mead.id },
    } });
    for (const [size, count] of [[0.75, 12], [0.375, 6]]) {
      const stock = await tx.inventory_stock.create({ data: {
        user_id: userId, mead_id: mead.id, name: mead.name,
        category: "mead", bottle_size_liters: size, quantity: 0, unit: "units",
      } });
      await writeInventoryBalance(tx, userId, operation.id, stock,
        { balance: { value: count, unit: "units" }, adjustment: count }, "receipt", null, "Initial local test bottles");
    }
  });
}

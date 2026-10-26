import { createHash, randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { ownedStorageStock, replaceStorage } from "../lib/db/inventory-storage";

/** Only called by the guarded local seed after stock and finished meads exist. */
export async function seedInventoryOrganization(
  database: PrismaClient,
  userId: number,
) {
  await database.$transaction(async (tx) => {
    const category = await tx.inventory_labels.create({
      data: { user_id: userId, name: "On hand" },
    });
    const ready = await tx.inventory_labels.create({
      data: { user_id: userId, name: "Ready to drink" },
    });
    const cellar = await tx.inventory_locations.create({
      data: { user_id: userId, name: "Cellar" },
    });
    const box = await tx.inventory_locations.create({
      data: { user_id: userId, name: "Box A2", parent_id: cellar.id },
    });
    const shelf = await tx.inventory_locations.create({
      data: { user_id: userId, name: "Brewing shelf" },
    });
    const operation = await tx.inventory_operations.create({
      data: {
        user_id: userId,
        operation_key: randomUUID(),
        request_hash: createHash("sha256")
          .update(`seed_inventory_organization:${userId}`)
          .digest("hex"),
        result: { id: category.id },
      },
    });
    const honey = await tx.inventory_stock.findFirst({
      where: { user_id: userId, category: "honey", archived_at: null },
    });
    if (honey) {
      await tx.inventory_label_links.create({
        data: { user_id: userId, stock_id: honey.id, label_id: category.id },
      });
      const quantity = Math.min(2, honey.quantity.toNumber());
      if (quantity)
        await replaceStorage(
          tx,
          userId,
          operation.id,
          await ownedStorageStock(tx, userId, honey.id),
          [{ location_id: shelf.id, position: "Left side", quantity }],
        );
    }
    const mead = await tx.inventory_meads.findFirst({
      where: { user_id: userId, archived_at: null },
      include: { stock: true },
    });
    if (mead) {
      await tx.inventory_label_links.createMany({
        data: [category.id, ready.id].map((label_id) => ({
          user_id: userId,
          mead_id: mead.id,
          label_id,
        })),
      });
      const bottles = mead.stock.find(
        (stock) => stock.bottle_size_liters?.toNumber() === 0.75,
      );
      if (bottles) {
        const quantity = Math.min(3, bottles.quantity.toNumber());
        if (quantity)
          await replaceStorage(
            tx,
            userId,
            operation.id,
            await ownedStorageStock(tx, userId, bottles.id),
            [{ location_id: box.id, position: "A1–A3", quantity }],
          );
      }
    }
  });
}

import { createHash, randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { stockInputSchema } from "@meadtools/inventory-domain";

/** Main seed calls this only after its local-database/reset guards. */
export async function seedInventory(database: PrismaClient, userId: number) {
  const fixtures = [
    { name: "Wildflower honey", category: "honey", quantity: { value: 10, unit: "kg" }, notes: "Shared stock for the Key Lime Pie and traditional recipes." },
    { name: "Key lime juice", category: "fruit", quantity: { value: 2, unit: "L" }, notes: "For the Key Lime Pie secondary additions." },
    { name: "Lalvin ICV D47", category: "yeast", quantity: { value: 25, unit: "g" }, notes: "Yeast used by the seeded Key Lime Pie recipe." },
    { name: "Fermentis SafAle US-05", category: "yeast", quantity: { value: 25, unit: "g" }, notes: "Yeast used by the seeded Mead Wiki traditional recipe." },
    { name: "Fermaid O", category: "additive", quantity: { value: 100, unit: "g" }, notes: "Nutrients for both example recipes." },
    { name: "Potassium metabisulfite", category: "additive", quantity: { value: 100, unit: "g" }, notes: "Stock for stabilization additions." },
    { name: "750 mL wine bottles", category: "packaging", quantity: { value: 48, unit: "units" }, notes: "Empty bottles available for packaging day." },
    { name: "330 mL beer bottles", category: "packaging", quantity: { value: 24, unit: "units" }, notes: "Empty bottles for small servings and test batches." },
    { name: "Wine corks", category: "packaging", quantity: { value: 50, unit: "units" }, notes: "Corks for the wine bottles." },
    { name: "Crown caps", category: "packaging", quantity: { value: 100, unit: "units" }, notes: "Caps for the beer bottles." },
  ].map((fixture) => stockInputSchema.parse(fixture));
  // Seed fixture creation bypasses rollout gates, like the premium/equipment seed.
  // Each starting balance and its initial receipt still commit together.
  await database.$transaction(async (tx) => {
    for (const fixture of fixtures) {
      const stock = await tx.inventory_stock.create({ data: {
        user_id: userId, name: fixture.name, category: fixture.category,
        quantity: fixture.quantity.value, unit: fixture.quantity.unit, notes: fixture.notes,
      } });
      const operation = await tx.inventory_operations.create({ data: {
        user_id: userId, operation_key: randomUUID(),
        request_hash: createHash("sha256").update(JSON.stringify({ kind: "seed_stock", stock: fixture })).digest("hex"),
        result: { stockId: stock.id, balance: fixture.quantity },
      } });
      await tx.inventory_adjustments.create({ data: {
        user_id: userId, stock_id: stock.id, operation_id: operation.id, kind: "receipt",
        delta: fixture.quantity.value, balance_after: fixture.quantity.value,
        unit: fixture.quantity.unit, note: "Initial local test stock",
      } });
    }
  });
}

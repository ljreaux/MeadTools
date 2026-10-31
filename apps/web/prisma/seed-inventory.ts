import { createHash, randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { stockInputSchema } from "@meadtools/inventory-domain";

/** Main seed calls this only after its local-database/reset guards. */
export async function seedInventory(database: PrismaClient, userId: number) {
  const fixtures = [
    {
      name: "Wildflower honey",
      category: "honey",
      quantity: { value: 10, unit: "kg" },
      notes: "Shared stock for the Key Lime Pie and traditional recipes.",
    },
    {
      name: "Key lime juice",
      category: "fruit",
      quantity: { value: 2, unit: "L" },
      notes: "For the Key Lime Pie secondary additions.",
    },
    {
      name: "Lalvin ICV D47",
      category: "yeast",
      quantity: { value: 25, unit: "g" },
      notes: "Yeast used by the seeded Key Lime Pie recipe.",
    },
    {
      name: "Fermentis SafAle US-05",
      category: "yeast",
      quantity: { value: 25, unit: "g" },
      notes: "Yeast used by the seeded Mead Wiki traditional recipe.",
    },
    {
      name: "Fermaid O",
      category: "additive",
      catalogReference: { catalog: "nutrient", id: "fermO" },
      quantity: { value: 100, unit: "g" },
      notes: "Nutrients for both example recipes.",
    },
    {
      name: "Fermaid K",
      category: "additive",
      catalogReference: { catalog: "nutrient", id: "fermK" },
      quantity: { value: 100, unit: "g" },
      notes: "Mixed nutrient additions test stock.",
    },
    {
      name: "DAP",
      category: "additive",
      catalogReference: { catalog: "nutrient", id: "dap" },
      quantity: { value: 100, unit: "g" },
      notes: "Mixed nutrient additions test stock.",
    },
    {
      name: "Go-Ferm",
      category: "additive",
      catalogReference: { catalog: "nutrient", id: "goFerm" },
      quantity: { value: 100, unit: "g" },
      notes: "Rehydration nutrient test stock.",
    },
    {
      name: "Go-Ferm Protect",
      category: "additive",
      catalogReference: { catalog: "nutrient", id: "goFermProtect" },
      quantity: { value: 100, unit: "g" },
      notes: "Alternative rehydration nutrient.",
    },
    {
      name: "Go-Ferm Sterol Flash",
      category: "additive",
      catalogReference: { catalog: "nutrient", id: "goFermSterolFlash" },
      quantity: { value: 100, unit: "g" },
      notes: "Alternative rehydration nutrient.",
    },
    {
      name: "Potassium metabisulfite",
      category: "additive",
      catalogReference: { catalog: "additive", id: "potassiumMetabisulfite" },
      quantity: { value: 100, unit: "g" },
      notes: "Stock for stabilization additions.",
    },
    {
      name: "Potassium sorbate",
      category: "additive",
      catalogReference: { catalog: "additive", id: "potassiumSorbate" },
      quantity: { value: 100, unit: "g" },
      notes: "Stabilization stock.",
    },
    {
      name: "Sodium metabisulfite",
      category: "additive",
      catalogReference: { catalog: "additive", id: "sodiumMetabisulfite" },
      quantity: { value: 100, unit: "g" },
      notes: "Alternative sulfite powder.",
    },
    {
      name: "Campden tablets (potassium)",
      category: "additive",
      catalogReference: { catalog: "additive", id: "campdenPotassium" },
      quantity: { value: 50, unit: "units" },
      notes: "Tablets are tracked by count, including partial tablets.",
    },
    {
      name: "Campden tablets (sodium)",
      category: "additive",
      catalogReference: { catalog: "additive", id: "campdenSodium" },
      quantity: { value: 50, unit: "units" },
      notes: "Alternative Campden tablets, tracked by count.",
    },
    {
      name: "750 mL wine bottles",
      category: "packaging",
      quantity: { value: 48, unit: "units" },
      notes: "Empty bottles available for packaging day.",
    },
    {
      name: "330 mL beer bottles",
      category: "packaging",
      quantity: { value: 24, unit: "units" },
      notes: "Empty bottles for small servings and test batches.",
    },
    {
      name: "Wine corks",
      category: "packaging",
      quantity: { value: 50, unit: "units" },
      notes: "Corks for the wine bottles.",
    },
    {
      name: "Crown caps",
      category: "packaging",
      quantity: { value: 100, unit: "units" },
      notes: "Caps for the beer bottles.",
    },
  ].map((fixture) => stockInputSchema.parse(fixture));
  // Seed fixture creation bypasses rollout gates, like the premium/equipment seed.
  // Each starting balance and its initial receipt still commit together.
  await database.$transaction(async (tx) => {
    for (const fixture of fixtures) {
      let reference = fixture.catalogReference;
      if (!reference && fixture.category === "yeast") {
        const rows = await tx.yeasts.findMany({
          select: { id: true, name: true, brand: true },
        });
        const match = rows.find(
          (row) => `${row.brand} ${row.name}` === fixture.name,
        );
        if (match) reference = { catalog: "yeast", id: String(match.id) };
      }
      if (!reference && fixture.category === "additive") {
        const match = await tx.additives.findFirst({
          where: { name: fixture.name },
          select: { id: true },
        });
        if (match) reference = { catalog: "additive", id: match.id };
      }
      const stock = await tx.inventory_stock.create({
        data: {
          user_id: userId,
          name: fixture.name,
          category: fixture.category,
          catalog: reference?.catalog ?? null,
          catalog_id: reference?.id ?? null,
          quantity: fixture.quantity.value,
          unit: fixture.quantity.unit,
          notes: fixture.notes,
        },
      });
      const operation = await tx.inventory_operations.create({
        data: {
          user_id: userId,
          operation_key: randomUUID(),
          request_hash: createHash("sha256")
            .update(JSON.stringify({ kind: "seed_stock", stock: fixture }))
            .digest("hex"),
          result: { stockId: stock.id, balance: fixture.quantity },
        },
      });
      await tx.inventory_adjustments.create({
        data: {
          user_id: userId,
          stock_id: stock.id,
          operation_id: operation.id,
          kind: "receipt",
          delta: fixture.quantity.value,
          balance_after: fixture.quantity.value,
          unit: fixture.quantity.unit,
          note: "Initial local test stock",
        },
      });
    }
  });
}

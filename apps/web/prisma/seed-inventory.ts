import { createHash, randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { stockInputSchema } from "@meadtools/inventory-domain";

/** Main seed calls this only after its local-database/reset guards. */
export async function seedInventory(database: PrismaClient, userId: number) {
  const fixtures = [
    {
      name: "Wildflower honey",
      category: "honey",
      quantity: { value: 25, unit: "lb" },
      notes: "Shared stock for the Key Lime Pie and traditional recipes.",
    },
    {
      name: "Key lime juice",
      category: "fruit",
      quantity: { value: 5, unit: "lb" },
      notes: "For the Key Lime Pie secondary additions. Tracked by weight to match the recipe's juice additions.",
    },
    {
      name: "Water",
      category: "additive",
      quantity: { value: 10, unit: "gal" },
      notes: "US gallons of brewing water for both example recipes.",
    },
    {
      name: "Lime Juice",
      category: "fruit",
      quantity: { value: 2, unit: "lb" },
      notes: "Juice reserved from the fifteen zested limes. Tracked by weight to match the recipe; the zest is tracked separately.",
    },
    {
      name: "Brown Sugar",
      category: "additive",
      quantity: { value: 4, unit: "lb" },
      notes: "Pantry stock for the Key Lime Pie secondary syrup; the recipe uses one pound.",
    },
    {
      name: "Red Wine Tannin",
      category: "additive",
      quantity: { value: 50, unit: "g" },
      notes: "For the six-gram primary addition.",
    },
    {
      name: "Lime Zest",
      category: "additive",
      quantity: { value: 18, unit: "units" },
      notes: "One unit is the zest of one lime. Enough for the recipe's fifteen limes, with spares; juice is tracked separately.",
    },
    {
      name: "Lactose",
      category: "additive",
      quantity: { value: 2, unit: "lb" },
      notes: "For the one-pound secondary syrup addition.",
    },
    {
      name: "Vanilla Bean",
      category: "additive",
      quantity: { value: 10, unit: "units" },
      notes: "Whole beans for the five-bean secondary addition.",
    },
    {
      name: "Cinnamon Stick",
      category: "additive",
      quantity: { value: 20, unit: "units" },
      notes: "Whole sticks for the ten-stick secondary addition.",
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
      notes: "Two cases of empty wine bottles; enough for the full Key Lime Pie batch with spares.",
    },
    {
      name: "12 fl oz beer bottles",
      category: "packaging",
      quantity: { value: 72, unit: "units" },
      notes: "Three cases of US 12 fl oz pry-off bottles (6.75 US gallons total). Enough for the full Key Lime Pie batch; use 26 mm crown caps.",
    },
    {
      name: "22 fl oz bomber bottles",
      category: "packaging",
      quantity: { value: 36, unit: "units" },
      notes: "US 22 fl oz pry-off bottles (6.1875 US gallons total). An alternative for the full batch; use 26 mm crown caps.",
    },
    {
      name: "32 fl oz swing-top bottles",
      category: "packaging",
      quantity: { value: 24, unit: "units" },
      notes: "Two cases of US quart swing-top bottles (6 US gallons total), with wire closures and gaskets fitted. An alternative for the full batch.",
    },
    {
      name: "Swing-top replacement gaskets",
      category: "packaging",
      quantity: { value: 24, unit: "units" },
      notes: "Spare gaskets for the seeded 32 fl oz swing-top bottles; closures are already fitted.",
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
      quantity: { value: 200, unit: "units" },
      notes: "26 mm crown caps for the 12 fl oz, 22 fl oz and 330 mL pry-off beer bottles, with spares.",
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

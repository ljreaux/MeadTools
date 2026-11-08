import { createHash, randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import {
  normalizeCostName,
  purchasePriceSchema,
  stockInputSchema,
  unitCostFromPrice,
} from "@meadtools/inventory-domain";

/**
 * Approximate local test prices in USD: the total paid for the stated package.
 * Supplies reuse the maintainer's local test records; honey, sugar, produce,
 * spices and spare packaging use typical US retail listings checked in
 * November 2026. They are examples, not price guidance.
 */
type SeedPrice = { amount: number; per: { value: number; unit: string }; source: string };
const prices: Record<string, SeedPrice> = {
  "Wildflower honey": { amount: 62.28, per: { value: 12, unit: "lb" }, source: "1 gallon (12 lb) raw wildflower honey jug" },
  "Key Lime Juice": { amount: 2.94, per: { value: 16, unit: "fl_oz" }, source: "16 fl oz bottle of key lime juice" },
  // The same limes supply zest and juice; their cost is counted once, on the zest.
  "Lime Juice": { amount: 0, per: { value: 18, unit: "fl_oz" }, source: "juice from the zested limes; the limes are costed with Lime Zest" },
  "Brown Sugar": { amount: 3.67, per: { value: 2, unit: "lb" }, source: "2 lb bag of light brown sugar" },
  "Red Wine Tannin": { amount: 10.99, per: { value: 100, unit: "g" }, source: "100 g wine tannin" },
  "Lime Zest": { amount: 0.35, per: { value: 1, unit: "units" }, source: "one fresh lime (zest and juice)" },
  Lactose: { amount: 4.99, per: { value: 1, unit: "lb" }, source: "1 lb lactose" },
  "Vanilla Bean": { amount: 12.36, per: { value: 20, unit: "units" }, source: "container of 20 Madagascar vanilla beans" },
  "Cinnamon Stick": { amount: 10.05, per: { value: 18, unit: "units" }, source: "8 oz jar, roughly 15-20 sticks" },
  "Lalvin ICV D47": { amount: 67.19, per: { value: 500, unit: "g" }, source: "500 g Lalvin ICV D47" },
  "Fermentis SafAle US-05": { amount: 49.99, per: { value: 100, unit: "g" }, source: "Fermentis SafAle US-05" },
  "Fermaid O": { amount: 62.99, per: { value: 750, unit: "g" }, source: "750 g Fermaid O" },
  "Fermaid K": { amount: 6.99, per: { value: 80, unit: "g" }, source: "80 g Fermaid K" },
  DAP: { amount: 4.99, per: { value: 2, unit: "oz" }, source: "2 oz diammonium phosphate" },
  "Go-Ferm": { amount: 48.99, per: { value: 625, unit: "g" }, source: "625 g Go-Ferm" },
  "Go-Ferm Protect": { amount: 48.99, per: { value: 625, unit: "g" }, source: "625 g Go-Ferm Protect" },
  "Go-Ferm Sterol Flash": { amount: 44.99, per: { value: 625, unit: "g" }, source: "625 g Go-Ferm Sterol Flash" },
  "Potassium metabisulfite": { amount: 11.99, per: { value: 16, unit: "oz" }, source: "1 lb potassium metabisulfite" },
  "Potassium sorbate": { amount: 19.99, per: { value: 16, unit: "oz" }, source: "1 lb potassium sorbate" },
  "Sodium metabisulfite": { amount: 5.49, per: { value: 1, unit: "lb" }, source: "1 lb sodium metabisulfite" },
  "Campden tablets (potassium)": { amount: 1.99, per: { value: 25, unit: "units" }, source: "25 potassium Campden tablets" },
  "Campden tablets (sodium)": { amount: 1.99, per: { value: 25, unit: "units" }, source: "25 sodium Campden tablets" },
  "750 mL wine bottles": { amount: 18.99, per: { value: 12, unit: "units" }, source: "case of 12 750 mL wine bottles" },
  "12 fl oz beer bottles": { amount: 17.99, per: { value: 24, unit: "units" }, source: "case of 24 12 fl oz pry-off bottles" },
  "22 fl oz bomber bottles": { amount: 16.99, per: { value: 12, unit: "units" }, source: "case of 12 22 fl oz bombers" },
  "32 fl oz swing-top bottles": { amount: 74.99, per: { value: 12, unit: "units" }, source: "case of 12 32 fl oz swing-top bottles" },
  "Swing-top replacement gaskets": { amount: 3.99, per: { value: 25, unit: "units" }, source: "bag of 25 swing-top gaskets" },
  "330 mL beer bottles": { amount: 17.76, per: { value: 24, unit: "units" }, source: "case of 24 small beer bottles (about $0.74 each)" },
  "Wine corks": { amount: 19.19, per: { value: 100, unit: "units" }, source: "bag of 100 #9 natural corks" },
  "Crown caps": { amount: 4.39, per: { value: 50, unit: "units" }, source: "50 crown caps" },
};
/** Not purchased for these examples, so not costed rather than left incomplete. */
const costExclusions = ["Water"];

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
      name: "Key Lime Juice",
      category: "fruit",
      quantity: { value: 48, unit: "fl_oz" },
      notes: "Three 16 fl oz bottles for the Key Lime Pie secondary addition (32 fl oz). Tracked by volume to match the recipe.",
    },
    {
      name: "Water",
      category: "additive",
      quantity: { value: 10, unit: "gal" },
      notes: "US gallons of brewing water for both example recipes. Not costed: tap water isn't purchased for these examples.",
    },
    {
      name: "Lime Juice",
      category: "fruit",
      quantity: { value: 18, unit: "fl_oz" },
      notes: "About 1 fl oz from each of the eighteen zested limes; the recipe uses 15 fl oz. Tracked by volume to match the recipe. The limes are costed once, with the zest.",
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
  const missingPrices = fixtures
    .map((fixture) => fixture.name)
    .filter((name) => !prices[name] && !costExclusions.includes(name));
  if (missingPrices.length)
    throw new Error(`Seed inventory prices are missing for: ${missingPrices.join(", ")}`);
  // Seed fixture creation bypasses rollout gates, like the premium/equipment seed.
  // Each starting balance, priced initial receipt and cost history commit together.
  await database.$transaction(async (tx) => {
    await tx.users.update({ where: { id: userId }, data: { inventory_currency: "USD" } });
    for (const name of costExclusions)
      await tx.inventory_cost_exclusions.create({
        data: { user_id: userId, name, name_key: normalizeCostName(name) },
      });
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
      const seedPrice = prices[fixture.name];
      if (!seedPrice) continue;
      // Same rules as a priced receipt into empty stock: the average is this price.
      const price = purchasePriceSchema.parse({ amount: seedPrice.amount, currency: "USD", per: seedPrice.per });
      const unitCost = unitCostFromPrice(price, fixture.quantity.unit);
      await tx.inventory_cost_events.create({
        data: {
          user_id: userId,
          stock_id: stock.id,
          unit: fixture.quantity.unit,
          operation_id: operation.id,
          kind: "receipt",
          balance_before: 0,
          received: fixture.quantity.value,
          price_amount: price.amount,
          price_currency: price.currency,
          price_per_value: price.per.value,
          price_per_unit: price.per.unit,
          applied_unit_cost: unitCost,
          unit_cost_after: unitCost,
          currency_after: price.currency,
          note: `Approximate local test price: ${seedPrice.source}`,
        },
      });
      await tx.inventory_stock.update({
        where: { id: stock.id },
        data: { unit_cost: unitCost, cost_currency: price.currency },
      });
    }
  });
}

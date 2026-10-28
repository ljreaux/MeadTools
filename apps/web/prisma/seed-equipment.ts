import { randomUUID } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { equipmentInputSchema } from "@meadtools/inventory-domain";

/** Called only after the main seed's local/destructive safety checks. */
export async function seedEquipment(database: PrismaClient, userId: number) {
  const recipeNames = ["Key Lime Pie", "Mead Wiki Simple Trad Metric"];
  const recipes = await database.recipes.findMany({
    where: { user_id: userId, name: { in: recipeNames } },
    select: { id: true, name: true, version: true, dataV2: true },
  });
  if (recipes.length !== recipeNames.length) throw new Error("Equipment seed needs both owned example recipes");

  await database.$transaction(async (tx) => {
    const brewIds = new Map<string, string>();
    for (const name of recipeNames) {
      const recipe = recipes.find((item) => item.name === name)!;
      const existing = await tx.brews.findFirst({
        where: { user_id: userId, recipe_id: recipe.id, end_date: null, stage: { not: "COMPLETE" } },
        orderBy: { start_date: "asc" }, select: { id: true },
      });
      const brew = existing ?? await tx.brews.create({ data: {
        user_id: userId, recipe_id: recipe.id, name: `${recipe.name} Equipment Test Brew`, stage: "PLANNED",
        recipe_snapshot: { id: recipe.id, name: recipe.name, version: recipe.version,
          dataV2: recipe.dataV2, sourceUserId: userId, snapshottedAt: new Date().toISOString() } as Prisma.InputJsonObject,
      }, select: { id: true } });
      brewIds.set(name, brew.id);
    }
    const bucketGroup = randomUUID();
    for (let i=0;i<6;i++) await tx.equipment.create({data:{user_id:userId,group_id:bucketGroup,name:"Brew bucket",type:"vessel",capacity:5,capacity_unit:"gal",label:i===0?"Blue lid":null,notes:"Six interchangeable five-gallon buckets; labels are optional."}});
    const fixtures = [
      { name: "Key Lime Pie primary fermenter", type: "vessel", capacity: { value: 7.5, unit: "gal" },
        notes: "US gallons. Headspace above the recipe's roughly five-gallon primary volume.", recipe: "Key Lime Pie" },
      { name: "Key Lime Pie secondary carboy", type: "vessel", capacity: { value: 6, unit: "gal" },
        notes: "US gallons. Available for the roughly five-and-a-half gallons after juice and syrup additions." },
      { name: "Traditional primary fermenter", type: "vessel", capacity: { value: 6, unit: "L" },
        notes: "Headspace for the four-liter Mead Wiki traditional recipe.", recipe: "Mead Wiki Simple Trad Metric" },
      { name: "Traditional aging carboy", type: "vessel", capacity: { value: 5, unit: "L" },
        notes: "Available for racking and aging the traditional batch." },
      { name: "Spare fermentation bucket", type: "vessel", capacity: { value: 3, unit: "gal" }, notes: "US gallons. Clean and available for split batches." },
      { name: "One-gallon test jug", type: "vessel", capacity: { value: 1, unit: "gal" }, notes: "US gallon. Available for a small test batch or leftover mead." },
      { name: "Bottling bucket with spigot", type: "vessel", capacity: { value: 6.5, unit: "gal" }, notes: "US gallons. Enough room to package the full Key Lime Pie batch." },
      { name: "Auto-siphon and tubing", type: "other", notes: "For transfers between primary and secondary containers." },
      { name: "Hydrometer and test jar", type: "other", notes: "For original and final gravity readings." },
      { name: "Digital scale", type: "other", notes: "For honey, yeast, nutrients and small additions." },
      { name: "Airlocks and bungs", type: "other", notes: "Spare airlocks and bungs for both recipes." },
      { name: "Spring-tip bottling wand", type: "other", notes: "Connects to the bottling bucket or siphon tubing." },
      { name: "Bench capper", type: "other", notes: "For the seeded pry-off beer bottles and 26 mm crown caps." },
      { name: "Floor corker", type: "other", notes: "For the seeded wine bottles and wine corks." },
      { name: "Long-handled mixing spoon", type: "other", notes: "For mixing honey into primary and blending secondary syrup." },
      { name: "Two-gallon syrup pot", type: "other", notes: "US gallons. Kitchen pot for the lime juice, honey, brown sugar and lactose syrup; not a fermentation vessel." },
      { name: "Citrus zester and juicer", type: "other", notes: "For the recipe's fifteen limes." },
      { name: "Fine-mesh straining bag", type: "other", notes: "For containing lime zest, vanilla beans and cinnamon sticks." },
      { name: "Thermometer", type: "other", notes: "Reads Fahrenheit and Celsius for rehydration and fermentation checks." },
      { name: "Funnel", type: "other", notes: "For adding cooled syrup and juice to the secondary carboy." },
      { name: "Bottle brush and drying rack", type: "other", notes: "For cleaning and draining bottles before sanitizing and filling." },
      { name: "Sanitizing bucket and spray bottle", type: "other", notes: "For preparing sanitizer and wetting equipment on transfer and bottling days." },
    ];
    for (const fixture of fixtures) {
      const { recipe, ...input } = fixture;
      const parsed = equipmentInputSchema.parse(input);
      const brewId = recipe ? brewIds.get(recipe)! : null;
      const item = await tx.equipment.create({ data: {
        user_id: userId, name: parsed.name, type: parsed.type, capacity: parsed.capacity?.value ?? null,
        capacity_unit: parsed.capacity?.unit ?? null, notes: parsed.notes, current_brew_id: brewId,
      } });
      if (brewId) await tx.equipment_assignment_events.create({ data: {
        user_id: userId, equipment_id: item.id, operation_key: randomUUID(), to_brew_id: brewId,
      } });
    }
  });
}

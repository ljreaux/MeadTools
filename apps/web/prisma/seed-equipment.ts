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
    const fixtures = [
      { name: "Key Lime Pie primary fermenter", type: "vessel", capacity: { value: 30, unit: "L" },
        notes: "Headspace for the roughly five-gallon Key Lime Pie batch.", recipe: "Key Lime Pie" },
      { name: "Key Lime Pie secondary carboy", type: "vessel", capacity: { value: 23, unit: "L" },
        notes: "Available for the juice and secondary additions." },
      { name: "Traditional primary fermenter", type: "vessel", capacity: { value: 6, unit: "L" },
        notes: "Headspace for the four-liter Mead Wiki traditional recipe.", recipe: "Mead Wiki Simple Trad Metric" },
      { name: "Traditional aging carboy", type: "vessel", capacity: { value: 5, unit: "L" },
        notes: "Available for racking and aging the traditional batch." },
      { name: "Spare fermentation bucket", type: "vessel", capacity: { value: 12, unit: "L" }, notes: "Clean and available." },
      { name: "Auto-siphon and tubing", type: "other", notes: "For transfers between primary and secondary vessels." },
      { name: "Hydrometer and test jar", type: "other", notes: "For original and final gravity readings." },
      { name: "Digital scale", type: "other", notes: "For honey, yeast, nutrients and small additions." },
      { name: "Airlocks and bungs", type: "other", notes: "Spare airlocks and bungs for both recipes." },
      { name: "Bottle filler and capper", type: "other", notes: "Extra equipment for packaging day." },
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

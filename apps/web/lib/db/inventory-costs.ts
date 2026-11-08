import "server-only";
import { Prisma, type PrismaClient, type inventory_stock } from "@prisma/client";
import { z } from "zod";
import {
  costLine,
  costPerBottle,
  costPerLiter,
  estimateRecipeCost,
  InventoryError,
  planReceiptCost,
  planValuationCost,
  summarizeCosts,
  tryInventoryEntryLines,
  convertQuantity,
  matchesCostExclusion,
  normalizeCostName,
  type CatalogReference,
  type CostExclusion,
  type CostSummary,
  type PurchasePrice,
  type Quantity,
  type StockCost,
} from "@meadtools/inventory-domain";
import { recipeDataV2Schema } from "@meadtools/schemas";
import { canReadBrewImage, canReadRecipeImage } from "@meadtools/brew-domain/images";
import type {
  BrewCostResponse,
  InventoryCostSummary,
  PublicCostSummary,
  RecipeCostResponse,
} from "@meadtools/api-contract/contracts";
import prisma from "@/lib/prisma";
import { getPremiumAccessStatus } from "./premium-access";
import { createInventoryOperation, InventoryWriteError } from "./inventory";

type Tx = Prisma.TransactionClient;
const uuid = z.string().uuid();

const decimal = (value: Prisma.Decimal | null) => (value === null ? null : value.toNumber());

export function stockCost(row: Pick<inventory_stock, "unit_cost" | "cost_currency">): StockCost {
  return row.unit_cost === null || !row.cost_currency
    ? { unitCost: null, currency: null }
    : { unitCost: row.unit_cost.toNumber(), currency: row.cost_currency };
}

/** Snapshot fields for a consumption written now from this stock's average. */
export function costSnapshot(row: Pick<inventory_stock, "unit_cost" | "cost_currency">) {
  const cost = stockCost(row);
  return cost.unitCost === null
    ? { unit_cost: null, cost_currency: null, costed_at: null }
    : { unit_cost: cost.unitCost, cost_currency: cost.currency, costed_at: new Date() };
}

async function accountCurrency(tx: Tx, userId: number) {
  const user = await tx.users.findUnique({ where: { id: userId }, select: { inventory_currency: true } });
  return user?.inventory_currency ?? null;
}

async function writeCostEvent(
  tx: Tx, userId: number, operationId: string, stock: inventory_stock,
  event: { kind: "receipt" | "valuation"; received: Quantity | null; price: PurchasePrice | null;
    applied: number | null; after: StockCost; note?: string | null },
) {
  const before = stockCost(stock);
  await tx.inventory_cost_events.create({ data: {
    user_id: userId, stock_id: stock.id, unit: stock.unit, operation_id: operationId,
    kind: event.kind, balance_before: stock.quantity,
    received: event.received ? convertQuantity(event.received, stock.unit).value : null,
    price_amount: event.price?.amount ?? null, price_currency: event.price?.currency ?? null,
    price_per_value: event.price?.per.value ?? null, price_per_unit: event.price?.per.unit ?? null,
    applied_unit_cost: event.applied,
    unit_cost_before: before.unitCost, currency_before: before.currency,
    unit_cost_after: event.after.unitCost, currency_after: event.after.currency,
    note: event.note ?? null,
  } });
  await tx.inventory_stock.update({ where: { id: stock.id }, data: {
    unit_cost: event.after.unitCost, cost_currency: event.after.currency,
  } });
}

/** Called in the receipt's inventory operation, with the row read before the receipt. */
export async function applyReceiptCost(
  tx: Tx, userId: number, operationId: string, stock: inventory_stock,
  received: Quantity, price: PurchasePrice | null, note: string | null = null,
) {
  if (received.value <= 0) {
    // A price recorded with no stock on hand still sets the unit cost.
    if (price) await applyValuationCost(tx, userId, operationId, stock, price, note);
    return;
  }
  const plan = planReceiptCost({
    balance: { value: stock.quantity.toNumber(), unit: stock.unit },
    current: stockCost(stock), receipt: received, price,
    accountCurrency: price ? await accountCurrency(tx, userId) : null,
  });
  const before = stockCost(stock);
  // Unpriced receipts into stock that has no known cost change nothing worth recording.
  if (!price && before.unitCost === null) return;
  await writeCostEvent(tx, userId, operationId, stock, {
    kind: "receipt", received, price, applied: plan.appliedUnitCost, after: plan.cost, note,
  });
}

export async function applyValuationCost(
  tx: Tx, userId: number, operationId: string, stock: inventory_stock,
  price: PurchasePrice, note: string | null,
) {
  const plan = planValuationCost({ stockUnit: stock.unit, price, accountCurrency: await accountCurrency(tx, userId) });
  await writeCostEvent(tx, userId, operationId, stock, {
    kind: "valuation", received: null, price, applied: plan.appliedUnitCost, after: plan.cost, note,
  });
}

function projectSummary(summary: CostSummary & { perLiter: number | null; volumeLiters: number | null },
  costedAt: Map<string, Date | null> = new Map(), excludedUses: Set<string> = new Set()): InventoryCostSummary {
  return {
    basis: summary.basis,
    totals: summary.totals,
    complete: summary.complete,
    mixed_currencies: summary.mixedCurrencies,
    per_liter: summary.perLiter,
    volume_liters: summary.volumeLiters,
    missing: summary.missing,
    short_lines: summary.shortLines,
    excluded_lines: summary.excludedLines,
    lines: summary.lines.map((line) => ({
      catalog_reference: line.catalogReference,
      exclusion: line.status !== "excluded" ? null : excludedUses.has(line.key) ? "use" as const : "ingredient" as const,
      kind: line.kind,
      key: line.key, name: line.name, quantity: line.quantity, stock_id: line.stockId,
      stock_name: line.stockName, status: line.status, unit_cost: line.unitCost, unit: line.unit,
      currency: line.currency, cost: line.cost, shortage: line.shortage, costed_at: costedAt.get(line.key)?.toISOString() ?? null,
    })),
  };
}

const projectExclusion = (row: { id: string; name: string; catalogReference: CatalogReference | null }) =>
  ({ id: row.id, name: row.name, catalog_reference: row.catalogReference });

/** Contract shape for a stored exclusion row (overview and exclusion endpoints). */
export function exclusionResponse(row: { id: string; name: string; catalog: string | null; catalog_id: string | null }) {
  return projectExclusion({ id: row.id, name: row.name,
    catalogReference: row.catalog && row.catalog_id ? { catalog: row.catalog, id: row.catalog_id } as CatalogReference : null });
}

/** Contract shape for a unit cost pair; a cost without its amount is unknown. */
export function costResponse(unitCost: Prisma.Decimal | null, currency: string | null) {
  return { unit_cost: decimal(unitCost), currency: unitCost === null ? null : currency };
}

const singleTotal = (summary: Pick<CostSummary, "totals">) =>
  summary.totals.length === 1 ? summary.totals[0].amount : null;

function publicSummary(summary: InventoryCostSummary, perBottle: PublicCostSummary["per_bottle"] = null): PublicCostSummary {
  return {
    basis: summary.basis, totals: summary.totals, complete: summary.complete,
    mixed_currencies: summary.mixed_currencies, per_liter: summary.per_liter,
    volume_liters: summary.volume_liters, per_bottle: perBottle,
  };
}

export function createInventoryCostService(database: PrismaClient = prisma) {
  const operation = createInventoryOperation(database);

  async function ownerStock(db: Tx | PrismaClient, userId: number) {
    const rows = await db.inventory_stock.findMany({
      where: { user_id: userId, archived_at: null, category: { not: "mead" } },
    });
    return rows.map((row) => ({
      id: row.id, name: row.name, category: row.category,
      quantity: { value: row.quantity.toNumber(), unit: row.unit },
      reconciliation_required: row.reconciliation_required,
      catalogReference: row.catalog && row.catalog_id
        ? { catalog: row.catalog as "ingredient", id: row.catalog_id } : null,
      cost: stockCost(row),
    }));
  }

  async function exclusions(db: Tx | PrismaClient, userId: number) {
    const rows = await db.inventory_cost_exclusions.findMany({
      where: { user_id: userId }, orderBy: [{ name: "asc" }, { id: "asc" }],
    });
    return rows.map((row) => {
      const projected = exclusionResponse(row);
      return { id: projected.id, name: projected.name, catalogReference: projected.catalog_reference };
    });
  }

  function recipeEstimate(data: unknown, stock: Awaited<ReturnType<typeof ownerStock>>, excluded: readonly CostExclusion[]) {
    const recipe = recipeDataV2Schema.safeParse(data);
    if (!recipe.success) return null;
    const estimate = estimateRecipeCost(recipe.data, stock, excluded);
    return projectSummary({ ...estimate, volumeLiters: estimate.batchLiters });
  }

  async function setCurrency(userId: number, currency: string) {
    return database.$transaction(async (tx) => {
      const status = await getPremiumAccessStatus(userId, new Date(), tx);
      if (!status.activeUser) throw new InventoryError("NOT_FOUND");
      if (!status.premiumEnabled) throw new InventoryWriteError("PREMIUM_REQUIRED");
      // Existing averages keep their own currency; totals then report mixed currencies.
      await tx.users.update({ where: { id: userId }, data: { inventory_currency: currency } });
      return { currency };
    });
  }

  async function recipeCosts(userId: number, recipeId: number): Promise<RecipeCostResponse> {
    const status = await getPremiumAccessStatus(userId, new Date(), database);
    const recipe = await database.recipes.findFirst({
      where: { id: recipeId, user_id: userId },
      select: { dataV2: true, share_cost_summary: true },
    });
    if (!status.activeUser || !recipe) throw new InventoryError("NOT_FOUND");
    const estimate = recipeEstimate(recipe.dataV2, await ownerStock(database, userId), await exclusions(database, userId));
    if (!estimate) throw new InventoryError("NOT_FOUND");
    return { can_manage: status.premiumEnabled, share_cost_summary: recipe.share_cost_summary, estimate };
  }

  async function brewVolume(db: Tx | PrismaClient, userId: number, brew: { id: string; current_volume_liters: number | null }) {
    const outputs = await db.inventory_productions.findMany({
      where: { user_id: userId, bottling: { brew_id: brew.id, removed_at: null } },
      include: { stock: { select: { bottle_size_liters: true } } },
    });
    const sizes = new Map<number, number>();
    for (const output of outputs) {
      const size = output.stock.bottle_size_liters?.toNumber();
      if (size) sizes.set(size, (sizes.get(size) ?? 0) + output.quantity);
    }
    const bottles = [...sizes].map(([sizeLiters, count]) => ({ sizeLiters, count }));
    const bottled = bottles.reduce((sum, row) => sum + row.sizeLiters * row.count, 0);
    return { bottles, bottled, current: brew.current_volume_liters };
  }

  async function brewCosts(userId: number, brewId: string): Promise<BrewCostResponse> {
    uuid.parse(brewId);
    const status = await getPremiumAccessStatus(userId, new Date(), database);
    const brew = await database.brews.findFirst({
      where: { id: brewId, user_id: userId },
      select: { id: true, recipe_snapshot: true, current_volume_liters: true, share_cost_summary: true },
    });
    if (!status.activeUser || !brew) throw new InventoryError("NOT_FOUND");
    const { recorded, planned } = await costBrew(userId, brew, true);
    return { can_manage: status.premiumEnabled, share_cost_summary: brew.share_cost_summary, recorded, planned };
  }

  /**
   * Recorded costs, plus the planned estimate when asked. Public totals skip
   * the owner's stock and use the recipe only as a last-resort volume.
   */
  async function costBrew(userId: number, brew: { id: string; recipe_snapshot: Prisma.JsonValue; current_volume_liters: number | null },
    includePlanned: boolean) {
    const brewId = brew.id;
    const uses = await database.inventory_consumptions.findMany({
      where: { user_id: userId, brew_id: brewId, reversed_at: null },
      include: { stock: { select: { name: true } } },
      orderBy: [{ created_at: "asc" }, { id: "asc" }],
    });
    const entryIds = [...new Set(uses.map((use) => use.entry_id))];
    const [entries, volume, excluded] = await Promise.all([
      entryIds.length ? database.brew_entries.findMany({
        where: { user_id: userId, brew_id: brewId, id: { in: entryIds } },
        select: { id: true, type: true, data: true },
      }) : Promise.resolve([]),
      brewVolume(database, userId, brew),
      exclusions(database, userId),
    ]);
    const costedAt = new Map<string, Date | null>();
    const excludedUses = new Set<string>();
    const lines = uses.map((use) => {
      const entry = entries.find((item) => item.id === use.entry_id);
      const entryLine = entry ? tryInventoryEntryLines(entry.type, entry.data)
        .find((line) => line.key === use.line_key) : undefined;
      const name = entryLine?.name || use.stock.name;
      // The ingredient's identity, not the shared stock item's, so an
      // account-wide choice cannot spread between brews through stock.
      const catalogReference = entryLine?.catalogReference ?? null;
      const key = `${use.entry_id}/${use.line_key}`;
      costedAt.set(key, use.costed_at);
      if (use.cost_excluded) excludedUses.add(key);
      return costLine({
        key, name, quantity: { value: use.deducted.toNumber(), unit: use.unit },
        catalogReference, kind: entryLine?.kind ?? null,
        excluded: use.cost_excluded || matchesCostExclusion({ name, catalogReference }, excluded),
        // Recorded costs come only from the snapshot, never from today's average.
        stock: { id: use.stock_id, name: use.stock.name, unit: use.unit,
          cost: { unitCost: decimal(use.unit_cost), currency: use.cost_currency } },
      });
    });
    const snapshot = brew.recipe_snapshot && typeof brew.recipe_snapshot === "object"
      ? (brew.recipe_snapshot as Record<string, unknown>).dataV2 : null;
    const needRecipe = includePlanned || !(volume.bottled > 0 || (volume.current ?? 0) > 0);
    const planned = needRecipe
      ? recipeEstimate(snapshot, includePlanned ? await ownerStock(database, userId) : [], excluded)
      : null;
    const summary = summarizeCosts("recorded_usage", lines);
    const [liters, source] = volume.bottled > 0 ? [volume.bottled, "bottled" as const]
      : volume.current && volume.current > 0 ? [volume.current, "current" as const]
        : planned?.volume_liters ? [planned.volume_liters, "recipe" as const] : [null, null];
    const total = singleTotal(summary);
    const perBottle = total === null ? null : costPerBottle(total, volume.bottles);
    return {
      recorded: {
        ...projectSummary({ ...summary, perLiter: total === null ? null : costPerLiter(total, liters), volumeLiters: liters }, costedAt, excludedUses),
        volume_source: source,
        per_bottle: perBottle?.map((row) => ({ size_liters: row.sizeLiters, count: row.count, amount: row.amount })) ?? null,
      },
      planned: includePlanned ? planned : null,
    };
  }

  /** Explicit owner action: re-snapshot every active use at current averages. */
  async function recalculateBrew(userId: number, operationKey: string, brewId: string) {
    uuid.parse(brewId);
    return operation(userId, operationKey, { kind: "recalculate_brew_costs", brewId },
      (result) => z.object({ updated: z.number().int() }).parse(result), async (tx) => {
        const brews = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT id FROM brews WHERE id = ${brewId}::uuid AND user_id = ${userId} FOR UPDATE
        `;
        if (!brews.length) throw new InventoryError("NOT_FOUND");
        const uses = await tx.inventory_consumptions.findMany({
          where: { user_id: userId, brew_id: brewId, reversed_at: null },
          include: { stock: { select: { unit_cost: true, cost_currency: true } } },
        });
        for (const use of uses)
          await tx.inventory_consumptions.update({ where: { id: use.id }, data: costSnapshot(use.stock) });
        return { updated: uses.length };
      });
  }

  /**
   * One recorded use only, such as reused bottles in this brew. The snapshot is
   * kept, so counting the use again restores its saved cost. Excluding requires
   * premium; counting again is always allowed.
   */
  async function setUseExclusion(userId: number, brewId: string, key: string, excluded: boolean) {
    uuid.parse(brewId);
    const separator = key.indexOf("/");
    const entryId = uuid.parse(key.slice(0, separator));
    const lineKey = key.slice(separator + 1);
    const status = await getPremiumAccessStatus(userId, new Date(), database);
    if (!status.activeUser) throw new InventoryError("NOT_FOUND");
    if (excluded && !status.premiumEnabled) throw new InventoryWriteError("PREMIUM_REQUIRED");
    const result = await database.inventory_consumptions.updateMany({
      where: { user_id: userId, brew_id: brewId, entry_id: entryId, line_key: lineKey, reversed_at: null },
      data: { cost_excluded: excluded },
    });
    if (!result.count) throw new InventoryError("NOT_FOUND");
  }

  async function setShare(userId: number, target: { brewId: string } | { recipeId: number }, share: boolean) {
    const status = await getPremiumAccessStatus(userId, new Date(), database);
    if (!status.activeUser) throw new InventoryError("NOT_FOUND");
    // Turning sharing off is always allowed; turning it on requires premium.
    if (share && !status.premiumEnabled) throw new InventoryWriteError("PREMIUM_REQUIRED");
    const result = "brewId" in target
      ? await database.brews.updateMany({ where: { id: uuid.parse(target.brewId), user_id: userId }, data: { share_cost_summary: share } })
      : await database.recipes.updateMany({ where: { id: target.recipeId, user_id: userId }, data: { share_cost_summary: share } });
    if (!result.count) throw new InventoryError("NOT_FOUND");
    return { share_cost_summary: share };
  }

  /** Opt-in totals for public viewers. Lines, stock and prices never leave here. */
  async function publicRecipeSummary(recipeId: number): Promise<PublicCostSummary | null> {
    const recipe = await database.recipes.findUnique({
      where: { id: recipeId },
      select: { user_id: true, private: true, share_cost_summary: true, dataV2: true, users: { select: { active: true } } },
    });
    if (!recipe || !canReadRecipeImage({ activeOwner: Boolean(recipe.users?.active), ownsRecipe: false, recipePublic: recipe.private === false }))
      throw new InventoryError("NOT_FOUND");
    if (!recipe.share_cost_summary || recipe.user_id === null) return null;
    const estimate = recipeEstimate(recipe.dataV2, await ownerStock(database, recipe.user_id), await exclusions(database, recipe.user_id));
    return estimate ? publicSummary(estimate) : null;
  }

  async function publicBrewSummary(brewId: string): Promise<PublicCostSummary | null> {
    const brew = await database.brews.findUnique({
      where: { id: uuid.parse(brewId) },
      select: { id: true, user_id: true, public: true, share_cost_summary: true, recipe_snapshot: true,
        current_volume_liters: true, recipes: { select: { private: true } }, users: { select: { active: true } } },
    });
    if (!brew || !canReadBrewImage({ activeOwner: Boolean(brew.users?.active), ownsBrew: false, brewPublic: brew.public, recipePublic: brew.recipes?.private === false }))
      throw new InventoryError("NOT_FOUND");
    if (!brew.share_cost_summary || brew.user_id === null) return null;
    const { recorded } = await costBrew(brew.user_id, brew, false);
    return publicSummary(recorded, recorded.per_bottle);
  }

  async function listExclusions(userId: number) {
    const status = await getPremiumAccessStatus(userId, new Date(), database);
    if (!status.activeUser) throw new InventoryError("NOT_FOUND");
    return { exclusions: (await exclusions(database, userId)).map(projectExclusion) };
  }

  /** Excluding requires premium; re-including is always allowed. Both are idempotent. */
  async function updateExclusions(userId: number, input:
    | { action: "exclude"; name: string; catalog_reference: CatalogReference | null }
    | { action: "include"; id: string }) {
    const status = await getPremiumAccessStatus(userId, new Date(), database);
    if (!status.activeUser) throw new InventoryError("NOT_FOUND");
    if (input.action === "exclude") {
      if (!status.premiumEnabled) throw new InventoryWriteError("PREMIUM_REQUIRED");
      const nameKey = normalizeCostName(input.name);
      if (!nameKey) throw new InventoryError("INVALID_QUANTITY");
      await database.inventory_cost_exclusions.upsert({
        where: { user_id_name_key: { user_id: userId, name_key: nameKey } },
        create: { user_id: userId, name: input.name.trim(), name_key: nameKey,
          catalog: input.catalog_reference?.catalog ?? null, catalog_id: input.catalog_reference?.id ?? null },
        // A later choice made from a catalog-linked line adds catalog matching.
        update: input.catalog_reference
          ? { catalog: input.catalog_reference.catalog, catalog_id: input.catalog_reference.id }
          : {},
      });
    } else {
      await database.inventory_cost_exclusions.deleteMany({ where: { id: uuid.parse(input.id), user_id: userId } });
    }
    return { exclusions: (await exclusions(database, userId)).map(projectExclusion) };
  }

  return { setUseExclusion, listExclusions, updateExclusions, setCurrency, recipeCosts, brewCosts, recalculateBrew, setShare, publicRecipeSummary, publicBrewSummary };
}

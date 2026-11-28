import type { InventoryStockItem } from "@meadtools/api-contract";

/** "all", one stock category, or the stock waiting for review. */
export type StockFilter = "all" | "review" | InventoryStockItem["category"];

/**
 * Filters the stock list by category or review state, then by name or
 * category label. Keeps the server's order (category, then name).
 */
export function queryStockList(
  stock: readonly InventoryStockItem[],
  {
    search,
    filter,
    locale,
    categoryLabel
  }: {
    search: string;
    filter: StockFilter;
    locale: string;
    categoryLabel: (category: InventoryStockItem["category"]) => string;
  }
): InventoryStockItem[] {
  const term = search.trim().toLocaleLowerCase(locale);
  return stock.filter((item) => {
    if (filter === "review" ? !item.reconciliation_required : filter !== "all" && item.category !== filter) {
      return false;
    }
    return !term || [item.name, categoryLabel(item.category)]
      .some((value) => value.toLocaleLowerCase(locale).includes(term));
  });
}

/** The filter chips to show: categories present in the stock, plus review when needed. */
export function stockFilterOptions(
  stock: readonly InventoryStockItem[],
  categories: readonly InventoryStockItem["category"][]
): StockFilter[] {
  const present = new Set(stock.map((item) => item.category));
  return [
    "all",
    ...(stock.some((item) => item.reconciliation_required) ? ["review" as const] : []),
    ...categories.filter((category) => present.has(category))
  ];
}

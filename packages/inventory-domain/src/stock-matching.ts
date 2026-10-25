import Fuse from "fuse.js";
import { nutrientCatalog, stabilizerCatalog } from "./catalog";
import { convertQuantity, type Quantity } from "./quantity";
import { lineCategories, type InventoryLine } from "./entry-lines";
import type { CatalogReference } from "./schemas";
export type MatchStock = {
  id: string;
  name: string;
  category: string;
  quantity: Quantity;
  reconciliation_required: boolean;
  catalogReference?: CatalogReference | null;
};
const normalized = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
/** Fuse ranks every stock match; category/unit checks remain hard eligibility rules. */
export function matchInventoryStock<T extends MatchStock>(
  stock: readonly T[],
  line: InventoryLine,
) {
  const choices = stock
    .filter(
      (item) =>
        !item.reconciliation_required &&
        lineCategories(line).includes(item.category),
    )
    .filter((item) => {
      try {
        convertQuantity(line.quantity, item.quantity.unit);
        return true;
      } catch {
        return false;
      }
    });
  const linked = line.catalogReference
    ? choices.filter(
        (item) =>
          item.catalogReference?.catalog === line.catalogReference!.catalog &&
          item.catalogReference.id === line.catalogReference!.id,
      )
    : [];
  if (linked.length)
    return {
      choices,
      stock: linked.length === 1 ? linked[0] : undefined,
      score: 0,
      warning: linked.length > 1 ? ("linked_ambiguous" as const) : null,
    };
  const records = choices
    .filter((item) => {
      if (item.catalogReference) return false;
      // A known product name carries an identity even on older, unlinked stock.
      // Shared words must not turn sorbate into sulfite, or Fermaid K into O.
      const nutrient = nutrientCatalog.find(
        (product) => normalized(product.name) === normalized(item.name),
      );
      const stabilizer = stabilizerCatalog.find(
        (product) => normalized(product.name) === normalized(item.name),
      );
      const reference = nutrient
        ? { catalog: "nutrient", id: nutrient.id }
        : stabilizer
          ? { catalog: "additive", id: stabilizer.id }
          : null;
      return (
        !line.catalogReference ||
        !reference ||
        (reference.catalog === line.catalogReference.catalog &&
          reference.id === line.catalogReference.id)
      );
    })
    .map((item) => ({ item, name: normalized(item.name) }));
  const productName =
    line.catalogReference?.catalog === "nutrient"
      ? nutrientCatalog.find(
          (product) => product.id === line.catalogReference?.id,
        )?.name
      : line.catalogReference?.catalog === "additive"
        ? stabilizerCatalog.find(
            (product) => product.id === line.catalogReference?.id,
          )?.name
        : undefined;
  const result = new Fuse(records, {
    keys: ["name"],
    includeScore: true,
    ignoreLocation: true,
    ignoreFieldNorm: true,
    threshold: 0.45,
  })
    .search(normalized(productName ?? line.name))
    .sort(
      (a, b) =>
        (a.score ?? 1) - (b.score ?? 1) ||
        a.item.name.localeCompare(b.item.name) ||
        a.item.item.id.localeCompare(b.item.item.id),
    );
  const closest = result[0];
  const score = closest?.score ?? 1;
  const ambiguous = Boolean(result[1] && (result[1].score ?? 1) - score < 0.06);
  return {
    choices,
    stock: closest?.item.item,
    score,
    warning: closest
      ? ambiguous
        ? ("ambiguous" as const)
        : score > 0.08
          ? ("weak" as const)
          : null
      : null,
  };
}

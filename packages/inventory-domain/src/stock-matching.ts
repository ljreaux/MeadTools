import Fuse from "fuse.js";
import { bottleDisplayMatches, type BottleDisplaySize } from "./finished-mead";
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

/** Packaging stock has no structured size; only an explicit volume is safe to infer. */
const packagingSizePattern = /(?:^|[^\w.])([0-9]+(?:[.,][0-9]+)?)\s*(ml|millilit(?:er|re)s?|l|lit(?:er|re)s?|(?:fl[\s._-]*)?oz|fluid\s+ounces?|gal|gallons?)\b/gi;
function packagingSize(name: string): BottleDisplaySize | undefined {
  // Fractions are unsupported; never read their denominator as a whole capacity.
  if (/\d\s*[/⁄]\s*\d/.test(name)) return undefined;
  const sizes = [...name.matchAll(packagingSizePattern)];
  if (sizes.length !== 1) return undefined;
  const [, amount, label] = sizes[0];
  const unit = label.toLowerCase();
  return {
    value: Number(amount.replace(",", ".")),
    unit: unit.startsWith("m") ? "mL" : unit.startsWith("l") ? "L"
      : unit.startsWith("g") ? "gal" : "fl_oz",
  };
}
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
  const automaticChoices = choices.filter((item) => {
    if (line.kind !== "PACKAGING" || line.sizeLiters == null) return true;
    const size = packagingSize(item.name);
    // Reuse the bottle rules, including the calculator's nominal rounded presets.
    return size != null && bottleDisplayMatches(line.sizeLiters, size);
  });
  const linked = line.catalogReference
    ? automaticChoices.filter(
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
  const matchName = (name: string) => normalized(
    line.kind === "PACKAGING" && line.sizeLiters != null
      ? name.replace(packagingSizePattern, " ") : name,
  );
  const records = automaticChoices
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
    .map((item) => ({ item, name: matchName(item.name) }));
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
  // An exact name is a stronger identity than a fuzzy score: "Lime Juice"
  // must not tie with "Key Lime Juice" just because one contains the other.
  const target = matchName(productName ?? line.name);
  const exact = (target ? records.filter((record) => record.name === target) : [])
    .sort((a, b) => a.item.name.localeCompare(b.item.name) || a.item.id.localeCompare(b.item.id));
  if (exact.length)
    return {
      choices,
      // Ties keep the same deterministic default as fuzzy ties, with a warning.
      stock: exact[0].item,
      score: 0,
      warning: exact.length > 1 ? ("ambiguous" as const) : null,
    };
  const result = new Fuse(records, {
    keys: ["name"],
    includeScore: true,
    ignoreLocation: true,
    ignoreFieldNorm: true,
    threshold: 0.45,
  })
    .search(matchName(productName ?? line.name))
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

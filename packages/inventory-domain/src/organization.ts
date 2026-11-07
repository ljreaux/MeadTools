import { z } from "zod";
import {
  convertQuantity,
  quantityValueSchema,
  toQuantityTicks,
  fromQuantityTicks,
  InventoryError,
  type Quantity,
} from "./quantity";

export const inventorySortFieldSchema = z.enum([
  "name",
  "amount",
  "volume",
  "location",
  "category",
  "type",
  "bottle_size",
]);
export const inventoryViewSchema = z
  .object({
    search: z.string().max(500),
    labels: z.array(z.string().uuid()).max(50),
    label_match: z.enum(["any", "all"]),
    locations: z.array(z.string().uuid()).max(50),
    types: z.array(z.string()).max(10),
    availability: z.enum(["all", "in_stock", "empty"]),
    sorts: z
      .array(
        z
          .object({
            field: inventorySortFieldSchema,
            direction: z.enum(["asc", "desc"]),
          })
          .strict(),
      )
      .max(7),
  })
  .strict()
  .refine(
    (view) =>
      new Set(view.sorts.map((sort) => sort.field)).size === view.sorts.length,
  );
export const defaultInventoryView = {
  search: "",
  labels: [],
  label_match: "any",
  locations: [],
  types: [],
  availability: "all",
  sorts: [{ field: "name", direction: "asc" }],
} satisfies z.infer<typeof inventoryViewSchema>;
export type InventoryView = z.infer<typeof inventoryViewSchema>;

export function inventoryLocationPaths(
  locations: readonly { id: string; name: string; parent_id: string | null }[],
) {
  const byId = new Map(locations.map((location) => [location.id, location]));
  const paths = new Map<string, string>();
  for (const location of locations) {
    const names: string[] = [],
      seen = new Set<string>();
    let current: typeof location | undefined = location;
    while (current) {
      if (seen.has(current.id)) throw new InventoryError("LINK_MISMATCH");
      seen.add(current.id);
      names.unshift(current.name);
      current = current.parent_id ? byId.get(current.parent_id) : undefined;
    }
    paths.set(location.id, names.join(" → "));
  }
  return paths;
}

/** Only the excess allocation needs reducing: unlocated stock is used first.
 * Caller orders locations by path/position, making the recorded choice stable. */
export function planStorageReduction(
  balance: number,
  allocations: readonly { id: string; quantity: number }[],
) {
  let excess =
    allocations.reduce(
      (sum, row) => sum + BigInt(toQuantityTicks(row.quantity)),
      BigInt(0),
    ) - BigInt(toQuantityTicks(balance));
  return allocations.flatMap((row) => {
    if (excess <= BigInt(0)) return [];
    const available = BigInt(toQuantityTicks(row.quantity));
    const taken = excess < available ? excess : available;
    excess -= taken;
    return [
      {
        id: row.id,
        quantity: fromQuantityTicks(Number(available - taken)),
        removed: fromQuantityTicks(Number(taken)),
      },
    ];
  });
}
export function validateAllocationTotal(
  balance: Quantity,
  amounts: readonly number[],
) {
  const total = amounts.reduce(
    (sum, amount) =>
      sum + BigInt(toQuantityTicks(quantityValueSchema.parse(amount))),
    BigInt(0),
  );
  const available = BigInt(toQuantityTicks(balance.value));
  if (total > available)
    throw new InventoryError("INSUFFICIENT_STOCK", {
      shortage: Number(total - available) / 1e6,
      unit: balance.unit,
    });
  return fromQuantityTicks(Number(available - total));
}

export type OrganizedInventoryItem = {
  id: string;
  name: string;
  notes: string | null;
  type: string;
  labels: string[];
  labelNames: string[];
  locations: string[];
  locationNames: string[];
  quantity: Quantity;
  volume: number;
  bottleSize: number;
};
const collator = new Intl.Collator("en", {
  numeric: true,
  sensitivity: "base",
});
function amountKey(quantity: Quantity): [string, number] {
  for (const unit of ["kg", "L", "units"] as const) {
    try {
      return [unit, convertQuantity(quantity, unit).value];
    } catch {
      /* Different dimension. */
    }
  }
  return [quantity.unit, quantity.value];
}
export function organizeInventory<T extends OrganizedInventoryItem>(
  items: readonly T[],
  view: InventoryView,
): T[] {
  const text = view.search.trim().toLocaleLowerCase();
  const filtered = items.filter((item) => {
    const match =
      view.label_match === "all"
        ? view.labels.every((id) => item.labels.includes(id))
        : !view.labels.length ||
          view.labels.some((id) => item.labels.includes(id));
    return (
      match &&
      (!view.locations.length ||
        view.locations.some((id) => item.locations.includes(id))) &&
      (!view.types.length || view.types.includes(item.type)) &&
      (view.availability === "all" ||
        (view.availability === "in_stock"
          ? item.quantity.value > 0
          : item.quantity.value === 0)) &&
      `${item.name} ${item.notes ?? ""} ${item.labelNames.join(" ")} ${item.locationNames.join(" ")}`
        .toLocaleLowerCase()
        .includes(text)
    );
  });
  const key = (
    item: T,
    field: InventoryView["sorts"][number]["field"],
  ): string | number => {
    switch (field) {
      case "name":
        return item.name;
      case "type":
        return item.type;
      case "category":
        return [...item.labelNames].sort(collator.compare).join("\n");
      case "location":
        return [...item.locationNames].sort(collator.compare).join("\n");
      case "volume":
        return item.volume;
      case "bottle_size":
        return item.bottleSize;
      case "amount":
        return amountKey(item.quantity)[1];
    }
  };
  return filtered.sort((a, b) => {
    for (const sort of view.sorts) {
      // Counts, mass and volume form separate groups; never equate kg with L.
      const dimension =
        sort.field === "amount"
          ? collator.compare(amountKey(a.quantity)[0], amountKey(b.quantity)[0])
          : 0;
      const av = key(a, sort.field),
        bv = key(b, sort.field);
      const result =
        dimension ||
        (typeof av === "number" && typeof bv === "number"
          ? av - bv
          : collator.compare(String(av), String(bv)));
      if (result) return sort.direction === "asc" ? result : -result;
    }
    return collator.compare(a.name, b.name) || a.id.localeCompare(b.id);
  });
}

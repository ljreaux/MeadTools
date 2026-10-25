import type { CatalogReference } from "./schemas";
export const nutrientCatalog = [
  { id: "fermO", name: "Fermaid O" },
  { id: "fermK", name: "Fermaid K" },
  { id: "dap", name: "DAP" },
  { id: "goFerm", name: "Go-Ferm" },
  { id: "goFermProtect", name: "Go-Ferm Protect" },
  { id: "goFermSterolFlash", name: "Go-Ferm Sterol Flash" },
] as const;
export function nutrientReference(key: unknown): CatalogReference | null {
  return nutrientCatalog.some((item) => item.id === key)
    ? { catalog: "nutrient", id: String(key) }
    : null;
}

/** Resolve legacy name-only additions only when a catalog name is exact and unique. */
export function resolveCatalogReferences<
  T extends {
    name: string;
    kind: string;
    catalogReference?: import("./schemas").CatalogReference | null;
  },
>(
  lines: T[],
  catalog: readonly {
    name: string;
    reference: import("./schemas").CatalogReference;
  }[],
): Array<
  T & { catalogReference?: import("./schemas").CatalogReference | null }
> {
  const normalize = (value: string) =>
    value
      .normalize("NFKD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  return lines.map((line) => {
    if (line.catalogReference || line.kind === "PACKAGING") return line;
    const expected =
      line.kind === "YEAST"
        ? ["yeast"]
        : line.kind === "NUTRIENT" || line.kind === "OTHER"
          ? ["additive", "nutrient"]
          : ["ingredient"];
    const matches = catalog.filter(
      (item) =>
        expected.includes(item.reference.catalog) &&
        normalize(item.name) === normalize(line.name),
    );
    return matches.length === 1
      ? { ...line, catalogReference: matches[0].reference }
      : line;
  });
}

// Stabilizers are built-in additives; these IDs do not depend on a database seed.
export const stabilizerCatalog = [
  { id: "potassiumSorbate", name: "Potassium sorbate" },
  { id: "potassiumMetabisulfite", name: "Potassium metabisulfite" },
  { id: "sodiumMetabisulfite", name: "Sodium metabisulfite" },
  { id: "campdenPotassium", name: "Campden tablets (potassium)" },
  { id: "campdenSodium", name: "Campden tablets (sodium)" },
] as const;
export function stabilizerReference(
  meta:
    | {
        stabilizerKind?: unknown;
        stabilizerType?: unknown;
        sulfiteForm?: unknown;
      }
    | undefined,
): CatalogReference | null {
  if (meta?.stabilizerKind === "sorbate")
    return { catalog: "additive", id: "potassiumSorbate" };
  if (meta?.stabilizerKind !== "sulfite") return null;
  return {
    catalog: "additive",
    id:
      meta.sulfiteForm === "campden"
        ? meta.stabilizerType === "nameta"
          ? "campdenSodium"
          : "campdenPotassium"
        : meta.stabilizerType === "nameta"
          ? "sodiumMetabisulfite"
          : "potassiumMetabisulfite",
  };
}

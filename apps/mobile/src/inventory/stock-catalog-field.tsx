import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { nutrientCatalog, stabilizerCatalog, type CatalogReference } from "@meadtools/inventory-domain";

import { useCatalog } from "@/catalogs/use-catalog";
import { CalculatorField } from "@/components/calculator-ui";
import { useApiClient } from "@/providers/app-providers";

import type { StockCategory } from "./stock-draft";
import { StockButton, StockInput, StockText } from "./stock-ui";

type Choice = CatalogReference & { name: string };
type SelectionProps = {
  value: CatalogReference | null;
  onChange: (value: CatalogReference | null) => void;
  disabled: boolean;
};

export function StockCatalogField({ category, ...selection }: SelectionProps & { category: StockCategory }) {
  if (category === "packaging") return null;
  return category === "additive"
    ? <AdditiveChoices {...selection} />
    : <CatalogChoices {...selection} kind={category === "yeast" ? "yeasts" : "ingredients"} />;
}

function CatalogChoices({ kind, ...selection }: SelectionProps & { kind: "yeasts" | "ingredients" }) {
  const query = useCatalog(kind);
  const choices: Choice[] = (query.data?.data ?? []).map((item) => ({
    catalog: kind === "yeasts" ? "yeast" : "ingredient",
    id: String(item.id),
    name: "brand" in item ? `${item.brand} ${item.name}` : item.name
  }));
  return <CatalogPicker {...selection} choices={choices} failed={query.isError} />;
}

function AdditiveChoices(selection: SelectionProps) {
  const api = useApiClient();
  const query = useQuery({ queryKey: ["catalog", "additives"], queryFn: () => api.listAdditives() });
  const choices: Choice[] = [
    ...(query.data ?? []).map(({ id, name }) => ({ id, name, catalog: "additive" as const })),
    ...nutrientCatalog.map((item) => ({ ...item, catalog: "nutrient" as const })),
    ...stabilizerCatalog.map((item) => ({ ...item, catalog: "additive" as const }))
  ];
  return <CatalogPicker {...selection} choices={choices} failed={query.isError} />;
}

function CatalogPicker({ value, onChange, disabled, choices, failed }: SelectionProps & {
  choices: Choice[];
  failed: boolean;
}) {
  const { t, i18n } = useTranslation();
  const [search, setSearch] = useState("");
  const query = search.trim().toLocaleLowerCase(i18n.language);
  const label = t("inventory.catalogLink");
  const current = value && choices.find((choice) => choice.catalog === value.catalog && choice.id === value.id);

  return (
    <CalculatorField label={label} hint={t("inventory.catalogHelp")}>
      {value && (
        <>
          <StockText>{current?.name ?? t("mobileInventory.catalogLinked")}</StockText>
          <StockButton label={t("inventory.catalogNone")} disabled={disabled} onPress={() => onChange(null)} />
        </>
      )}
      <StockInput
        accessibilityLabel={label}
        editable={!disabled}
        onChangeText={setSearch}
        placeholder={t("mobileInventory.catalogSearch")}
        value={search}
      />
      {query && choices.filter(({ name }) => name.toLocaleLowerCase(i18n.language).includes(query))
        .slice(0, 6).map(({ catalog, id, name }) => (
          <StockButton
            key={`${catalog}:${id}`}
            label={name}
            disabled={disabled}
            onPress={() => {
              onChange({ catalog, id });
              setSearch("");
            }}
          />
        ))}
      {failed ? <StockText kind="muted">{t("inventory.catalogLoadError")}</StockText> : null}
    </CalculatorField>
  );
}

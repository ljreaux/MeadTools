"use client";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  nutrientCatalog,
  stabilizerCatalog,
  type CatalogReference,
} from "@meadtools/inventory-domain";
import { useIngredientsQuery } from "@/hooks/reactQuery/useIngredientsQuery";
import { useYeastsQuery } from "@/hooks/reactQuery/useYeastsQuery";
import { useAdditivesQuery } from "@/hooks/reactQuery/useAdditivesQuery";
import SearchableInput from "@/components/ui/SearchableInput";
import { Label } from "@/components/ui/label";
const getValue = (item: { value: string }) => item.value;
export function InventoryCatalogField({
  category,
  value,
  onChange,
  disabled,
}: {
  category: string;
  value: CatalogReference | null;
  onChange: (value: CatalogReference | null) => void;
  disabled: boolean;
}) {
  const { t } = useTranslation();
  const id = useId();
  const [query, setQuery] = useState<string | null>(null);
  const ingredients = useIngredientsQuery();
  const yeasts = useYeastsQuery();
  const additives = useAdditivesQuery();
  const records =
    category === "yeast"
      ? (yeasts.data ?? []).map((item) => ({
          name: `${item.brand} ${item.name}`,
          catalog: "yeast" as const,
          id: String(item.id),
        }))
      : category === "additive"
        ? [
            ...(additives.data ?? []).map((item) => ({
              name: item.name,
              catalog: "additive" as const,
              id: String(item.id),
            })),
            ...nutrientCatalog.map((item) => ({
              ...item,
              catalog: "nutrient" as const,
            })),
            ...stabilizerCatalog.map((item) => ({
              ...item,
              catalog: "additive" as const,
            })),
          ]
        : (ingredients.data ?? []).map((item) => ({
            name: item.name,
            catalog: "ingredient" as const,
            id: String(item.id),
          }));
  const options = [
    {
      value: "none",
      name: t("inventory.catalogNone"),
      reference: null as CatalogReference | null,
    },
    ...records.map((item) => ({
      value: `${item.catalog}:${item.id}`,
      name: item.name,
      reference: { catalog: item.catalog, id: item.id },
    })),
  ];
  if (category === "packaging") return null;
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{t("inventory.catalogLink")}</Label>
      <SearchableInput
        id={id}
        items={options}
        keyName="name"
        getValue={getValue}
        query={query ?? (value ? `${value.catalog}:${value.id}` : "none")}
        disabled={disabled}
        setQuery={(text) => {
          setQuery(text);
          onChange(null);
        }}
        onSelect={(item) => {
          setQuery(null);
          onChange(item.reference);
        }}
      />
      <p className="text-sm text-muted-foreground">
        {t("inventory.catalogHelp")}
      </p>
      {ingredients.isError || yeasts.isError || additives.isError ? (
        <p role="alert" className="text-sm text-destructive">
          {t("inventory.catalogLoadError")}
        </p>
      ) : null}
    </div>
  );
}

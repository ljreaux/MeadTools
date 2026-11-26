import { useTranslation } from "react-i18next";

import type { InventoryStorageSource } from "@meadtools/api-contract";

import { CalculatorField, Chips } from "@/components/calculator-ui";

import { useInventoryOrganization } from "./use-collections";

export function StorageSourceField({ stockId, value, onChange, disabled }: {
  stockId: string;
  value: InventoryStorageSource | undefined;
  onChange: (source: InventoryStorageSource | undefined) => void;
  disabled: boolean;
}) {
  const { t } = useTranslation();
  const { data } = useInventoryOrganization();
  const stock = data?.stock.find(({ id }) => id === stockId);
  if (!stock?.allocations.length) return null;
  const choices = [
    { id: "automatic", label: t("inventory.organization.automaticSource"), source: undefined },
    { id: "unlocated", label: t("inventory.organization.unlocated"), source: "unlocated" as const },
    ...stock.allocations.map(({ location_id, position, quantity }) => {
      const path = data?.locations.find(({ id }) => id === location_id)?.path ?? t("inventory.organization.unavailableLocation");
      const source = { location_id, position };
      return { id: JSON.stringify(source), label: [path, position, String(quantity)].filter(Boolean).join(" · "), source };
    })
  ];
  const label = t("inventory.organization.useFrom");
  return (
    <CalculatorField label={label}>
      <Chips label={label} options={choices.map(({ id }) => id)}
        value={value === undefined ? "automatic" : value === "unlocated" ? value : JSON.stringify(value)}
        optionLabel={(id) => choices.find((choice) => choice.id === id)!.label}
        onChange={(id) => { if (!disabled) onChange(choices.find((choice) => choice.id === id)?.source); }} />
    </CalculatorField>
  );
}

"use client";
import { useId } from "react";
import { useTranslation } from "react-i18next";
import type {
  InventoryOrganizationResponse,
  InventoryStorageSource,
} from "@meadtools/api-contract/contracts";
import type {
  OrganizedInventoryItem,
  Quantity,
} from "@meadtools/inventory-domain";
import {
  useInventoryOrganization,
  targetLabels,
} from "./InventoryOrganizationProvider";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectValue,
  SelectItem,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

export function organizationMetadata(
  data: InventoryOrganizationResponse | undefined,
  kind: "stock" | "mead",
  id: string,
) {
  const labels = targetLabels(data, kind, id);
  const stock =
    data?.stock.filter((row) =>
      kind === "stock" ? row.id === id : row.mead_id === id,
    ) ?? [];
  const allocations = stock.flatMap((row) =>
    row.allocations.map((allocation) => ({
      ...allocation,
      unit: row.quantity.unit,
      size: row.bottle_size_liters,
    })),
  );
  const directIds = [...new Set(allocations.map((row) => row.location_id))];
  const locations = new Set(directIds);
  for (const id of directIds) {
    let current = data?.locations.find((row) => row.id === id);
    while (current?.parent_id) {
      locations.add(current.parent_id);
      current = data?.locations.find((row) => row.id === current?.parent_id);
    }
  }
  return {
    labels,
    labelNames: labels.flatMap(
      (id) => data?.labels.find((row) => row.id === id)?.name ?? [],
    ),
    locations: [...locations],
    locationNames: directIds.flatMap(
      (id) => data?.locations.find((row) => row.id === id)?.path ?? [],
    ),
    allocations,
    stock,
  };
}
export function organizedItem(
  data: InventoryOrganizationResponse | undefined,
  kind: "stock" | "mead",
  item: {
    id: string;
    name: string;
    notes: string | null;
    type: string;
    quantity: Quantity;
    volume?: number;
    bottleSize?: number;
  },
): OrganizedInventoryItem {
  return {
    ...item,
    ...organizationMetadata(data, kind, item.id),
    volume: item.volume ?? 0,
    bottleSize: item.bottleSize ?? 0,
  };
}
export function InventoryOrganizationSummary({
  kind,
  id,
}: {
  kind: "stock" | "mead";
  id: string;
}) {
  const { t, i18n } = useTranslation();
  const { overview } = useInventoryOrganization();
  const metadata = organizationMetadata(overview.data, kind, id);
  const number = (value: number) =>
    new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 6 }).format(
      value,
    );
  return (
    <div className="space-y-2">
      {metadata.labelNames.length ? (
        <div className="flex flex-wrap gap-1">
          {metadata.labelNames.map((name) => (
            <span
              key={name}
              className="max-w-full break-words rounded-full bg-secondary px-2 py-1 text-xs"
            >
              {name}
            </span>
          ))}
        </div>
      ) : null}
      {metadata.allocations.length ? (
        <ul className="space-y-1 text-xs text-muted-foreground">
          {metadata.allocations.slice(0, 3).map((row) => (
            <li
              key={`${row.location_id}:${row.position}:${row.size}`}
              className="break-words"
            >
              {
                overview.data?.locations.find(
                  (location) => location.id === row.location_id,
                )?.path
              }
              {row.position ? ` · ${row.position}` : ""} ·{" "}
              {number(row.quantity)}{" "}
              {t(
                kind === "mead"
                  ? "inventory.meads.bottlesUnit"
                  : `inventory.units.${row.unit}`,
              )}
              {row.size ? ` (${number(row.size * 1000)} mL)` : ""}
            </li>
          ))}
          {metadata.allocations.length > 3 ? (
            <li>
              {t("inventory.organization.morePositions", {
                count: metadata.allocations.length - 3,
              })}
            </li>
          ) : null}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">
          {t("inventory.organization.unlocated")}
        </p>
      )}
    </div>
  );
}

export function InventoryUseSource({
  stockId,
  value,
  onChange,
  disabled,
}: {
  stockId: string | undefined;
  value: InventoryStorageSource | undefined;
  onChange: (value: InventoryStorageSource | undefined) => void;
  disabled: boolean;
}) {
  const { t, i18n } = useTranslation();
  const { overview } = useInventoryOrganization();
  const id = useId();
  const stock = overview.data?.stock.find((row) => row.id === stockId);
  if (!stock?.allocations.length) return null;
  const unlocated =
    Math.round(
      (stock.quantity.value -
        stock.allocations.reduce((sum, row) => sum + row.quantity, 0)) *
        1e6,
    ) / 1e6;
  const key = (row: { location_id: string; position: string }) =>
    JSON.stringify([row.location_id, row.position]);
  const format = (amount: number) =>
    new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 6 }).format(
      amount,
    );
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{t("inventory.organization.useFrom")}</Label>
      <Select
        value={
          value === undefined
            ? "auto"
            : value === "unlocated"
              ? value
              : key(value)
        }
        disabled={disabled}
        onValueChange={(selected) => {
          if (selected === "auto") onChange(undefined);
          else if (selected === "unlocated") onChange(selected);
          else {
            const allocation = stock.allocations.find(
              (row) => key(row) === selected,
            );
            if (allocation)
              onChange({
                location_id: allocation.location_id,
                position: allocation.position,
              });
          }
        }}
      >
        <SelectTrigger
          id={id}
          className="h-auto min-h-9 text-left [&>span]:whitespace-normal"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="auto">
            {t("inventory.organization.automaticSource")}
          </SelectItem>
          <SelectItem value="unlocated">
            {t("inventory.organization.unlocated")} · {format(unlocated)}
          </SelectItem>
          {stock.allocations.map((row) => (
            <SelectItem key={key(row)} value={key(row)}>
              {
                overview.data?.locations.find(
                  (location) => location.id === row.location_id,
                )?.path
              }
              {row.position ? ` · ${row.position}` : ""} ·{" "}
              {format(row.quantity)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">
        {t("inventory.organization.deductionOrder")}
      </p>
    </div>
  );
}

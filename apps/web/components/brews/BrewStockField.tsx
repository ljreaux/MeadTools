"use client";
import { useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  inventoryEntryLines,
  matchInventoryStock,
  planEntryInventory,
  type InventoryLine,
} from "@meadtools/inventory-domain";
import type { BrewInventorySelection } from "@meadtools/api-contract/contracts";
import {
  captureStockChoiceBaseline,
  type StockChoiceBaseline,
} from "@/lib/brews/stockChoiceBaseline";
import { useBrewInventory } from "./BrewInventoryProvider";
import { Label } from "@/components/ui/label";
import SearchableInput from "@/components/ui/SearchableInput";
const valueOf = (item: { id: string }) => item.id;
export function useBrewStockChoice(
  data: unknown,
  entryId?: string,
  entryType = "ADDITION",
  overrideLines?: InventoryLine[],
  invalidLines = false,
) {
  const inventory = useBrewInventory();
  const { t, i18n } = useTranslation();
  const id = useId();
  const live =
    inventory?.usages.filter((use) => use.entry_id === entryId) ?? [];
  const [baseline, setBaseline] = useState<StockChoiceBaseline | null>(null);
  if (!entryId && baseline) setBaseline(null);
  if (entryId && inventory?.canManage && baseline?.entryId !== entryId)
    setBaseline(
      captureStockChoiceBaseline(entryId, {
        usages: inventory.usages,
        tracked_entry_ids: inventory.trackedEntryIds,
      }),
    );
  const previous =
    baseline && baseline.entryId === entryId ? baseline.uses : live;
  const tracked =
    baseline && baseline.entryId === entryId
      ? baseline.tracked
      : inventory?.trackedEntryIds.includes(entryId ?? "");
  let parseError = invalidLines;
  let rawLines: InventoryLine[] = [];
  try {
    rawLines = overrideLines ?? inventoryEntryLines(entryType, data);
  } catch {
    parseError = true;
  }
  const lines = inventory?.resolveLines(rawLines) ?? rawLines;
  const [choices, setChoices] = useState<
    Record<string, { value: string; query: string }>
  >({});
  const operation = useRef<string | null>(null);
  const stocks = [
    ...(inventory?.stock ?? []),
    ...previous
      .filter(
        (use) => !inventory?.stock.some((stock) => stock.id === use.stock_id),
      )
      .map((use) => use.stock),
  ];
  const rows = lines.map((line) => {
    const key = JSON.stringify([
      entryId,
      line.key,
      line.name,
      line.kind,
      line.catalogReference,
    ]);
    const prior = previous.find((use) => use.line_key === line.key);
    const match = matchInventoryStock(
      stocks.filter(
        (stock) =>
          !previous.some(
            (use) => use.stock_id === stock.id && use.stock_archived,
          ),
      ),
      line,
    );
    const selected =
      choices[key]?.value ??
      (prior && (!prior.line_name || prior.line_name === line.name)
        ? prior.stock_archived
          ? ""
          : prior.stock_id
        : match.warning === "linked_ambiguous"
          ? ""
          : (match.stock?.id ?? "untracked"));
    return {
      line,
      key,
      prior,
      match,
      selected,
      query: choices[key]?.query ?? selected,
    };
  });
  const enabled = Boolean(inventory?.canManage && (lines.length || parseError));
  const editable = !entryId || tracked;
  const bindings = rows.map((row) => ({
    line_key: row.line.key,
    stock_id: row.selected === "untracked" ? null : row.selected || null,
  }));
  const expected = previous.map(({ line_key, stock_id, deducted }) => ({
    line_key,
    stock_id,
    deducted,
  }));
  let balances: ReturnType<typeof planEntryInventory>["balances"] = [];
  let problem = "";
  if (enabled && editable)
    try {
      if (
        rows.some(
          (row) => !row.selected || (row.prior && row.selected === "untracked"),
        )
      )
        throw new Error("SELECTION_REQUIRED");
      if (
        stocks.some(
          (stock) =>
            stock.reconciliation_required &&
            [...bindings, ...expected].some((use) => use.stock_id === stock.id),
        )
      )
        throw new Error("RECONCILIATION_REQUIRED");
      balances = planEntryInventory({
        stocks,
        lines,
        bindings,
        previous: expected,
      }).balances;
    } catch (error) {
      problem = t(
        `inventory.errors.${error instanceof Error ? error.message : "INSUFFICIENT_STOCK"}`,
        t("inventory.invalid"),
      );
    }
  const valid =
    !enabled ||
    !editable ||
    (!parseError &&
      !problem &&
      !inventory?.stockLoading &&
      !inventory?.stockError);
  const format = (value: number) =>
    new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 6 }).format(
      value,
    );
  function selection(): BrewInventorySelection | undefined {
    if (!enabled || !editable) return undefined;
    operation.current ??= crypto.randomUUID();
    return {
      mode: "items",
      operation_id: operation.current,
      items: bindings,
      expected,
    };
  }
  const field = enabled ? (
    <div className="space-y-3 rounded-lg border p-3">
      {!editable ? (
        <p className="text-sm text-muted-foreground">
          {t("brewInventory.untrackedExisting")}
        </p>
      ) : (
        <>
          {rows.map((row) => {
            const options = [
              ...(!row.prior
                ? [
                    {
                      id: "untracked",
                      label: t("brewInventory.untrackedChoice"),
                    },
                  ]
                : []),
              ...row.match.choices.map((stock) => ({
                id: stock.id,
                label: `${stock.name} · ${format(stock.quantity.value)} ${t(`inventory.units.${stock.quantity.unit}`)}`,
              })),
            ];
            const warning =
              row.match.warning === "linked_ambiguous"
                ? "matchLinkedAmbiguous"
                : row.match.warning === "ambiguous"
                  ? "matchAmbiguous"
                  : row.match.warning === "weak"
                    ? "matchWeak"
                    : null;
            const stock = stocks.find((stock) => stock.id === row.selected);
            return (
              <div key={row.key} className="space-y-2">
                <Label htmlFor={`${id}-${row.line.key}`}>
                  {row.line.name} · {format(row.line.quantity.value)}{" "}
                  {t(`inventory.units.${row.line.quantity.unit}`)}
                </Label>
                <SearchableInput
                  id={`${id}-${row.line.key}`}
                  items={options}
                  keyName="label"
                  getValue={valueOf}
                  query={row.query}
                  setQuery={(query) =>
                    setChoices((old) => ({
                      ...old,
                      [row.key]: { value: "", query },
                    }))
                  }
                  onSelect={(item) =>
                    setChoices((old) => ({
                      ...old,
                      [row.key]: { value: item.id, query: item.id },
                    }))
                  }
                />
                {warning && !choices[row.key] && !row.prior ? (
                  <p className="text-xs text-muted-foreground">
                    {t(`brewInventory.${warning}`)}
                  </p>
                ) : null}
                {stock?.catalogReference &&
                stock.id === row.match.stock?.id &&
                !row.match.warning ? (
                  <p className="text-xs text-muted-foreground">
                    {t("brewInventory.matchLinked")}
                  </p>
                ) : null}
              </div>
            );
          })}
          <p
            className={`text-xs ${problem || inventory?.stockError ? "text-destructive" : "text-muted-foreground"}`}
            role={problem ? "alert" : undefined}
          >
            {inventory?.stockLoading
              ? t("inventory.loading")
              : inventory?.stockError
                ? t("inventory.loadError")
                : problem ||
                  (parseError
                    ? t("inventory.invalid")
                    : t(
                        bindings.some((binding) => binding.stock_id)
                          ? "brewInventory.reviewHelp"
                          : "brewInventory.untrackedHelp",
                      ))}
          </p>
          {!problem
            ? balances.map((balance) => {
                const stock = stocks.find(
                  (stock) => stock.id === balance.stock_id,
                )!;
                return (
                  <p key={stock.id} className="text-xs text-muted-foreground">
                    {stock.name}:{" "}
                    {t("inventory.balanceAfter", {
                      value: format(balance.quantity.value),
                      unit: t(`inventory.units.${balance.quantity.unit}`),
                    })}
                  </p>
                );
              })
            : null}
        </>
      )}
    </div>
  ) : null;
  function removalSelection(): BrewInventorySelection | undefined {
    if (!inventory?.canManage || !previous.length) return undefined;
    operation.current ??= crypto.randomUUID();
    return {
      mode: "items",
      operation_id: operation.current,
      items: [],
      expected,
    };
  }
  const removalNotice =
    inventory?.canManage && previous.length
      ? previous
          .map((use) =>
            t("brewInventory.reverseHelp", {
              quantity: `${format(use.deducted.value)} ${t(`inventory.units.${use.deducted.unit}`)}`,
              name: use.stock.name,
            }),
          )
          .join(" ")
      : undefined;
  return {
    field,
    valid,
    selection,
    removalSelection,
    removalNotice,
    saved: async (savedEntryId: string) => {
      if (inventory?.canManage) {
        const fresh = await inventory.refreshInventory();
        setBaseline(captureStockChoiceBaseline(savedEntryId, fresh));
      }
      setChoices({});
      operation.current = null;
    },
    resetOperation: () => {
      operation.current = null;
    },
  };
}

import { useTranslation } from "react-i18next";

import type { InventoryCostExclusion, InventoryCostSummary, InventoryBottleCost, UpdateInventoryCostExclusionsRequestBody } from "@meadtools/api-contract";
import { VOLUME_TO_L } from "@meadtools/core/recipe";
import { matchesCostExclusion } from "@meadtools/inventory-domain";

import { useCostFormat } from "./cost-format";
import { StockButton, StockCard, StockText } from "./stock-ui";

export function CostSummaryView({ summary, empty, exclusions, busy, onExclusion, onUse }: {
  summary: InventoryCostSummary & { per_bottle?: InventoryBottleCost[] | null };
  empty: string;
  exclusions: InventoryCostExclusion[];
  busy: boolean;
  onExclusion: (input: UpdateInventoryCostExclusionsRequestBody) => void;
  onUse?: (key: string, excluded: boolean) => void;
}) {
  const { t } = useTranslation();
  const { money, number } = useCostFormat();
  const currency = summary.totals.length === 1 && !summary.mixed_currencies ? summary.totals[0].currency : null;
  const allExcluded = summary.excluded_lines === summary.lines.length;
  if (!summary.lines.length) return <StockText kind="muted">{empty}</StockText>;
  return (
    <>
      <StockCard>
        {summary.totals.map(({ currency: code, amount }) => (
          <StockText key={code} kind="heading">{money(amount, code)}</StockText>
        ))}
        {!summary.totals.length && !allExcluded ? <StockText kind="heading">{t("inventoryCosts.noTotal")}</StockText> : null}
        <StockText>{t(allExcluded ? "inventoryCosts.allExcluded" :
          summary.mixed_currencies ? "inventoryCosts.mixedCurrencies" : summary.complete ? "inventoryCosts.complete" : "inventoryCosts.incomplete")}</StockText>
        {currency && summary.per_liter !== null && summary.volume_liters !== null ? (
          <StockText kind="muted">{t("inventoryCosts.perVolume", {
            perLiter: money(summary.per_liter, currency),
            perGallon: money(summary.per_liter * VOLUME_TO_L.gal, currency),
            liters: number(summary.volume_liters)
          })}</StockText>
        ) : null}
        {currency && summary.per_bottle?.length ? (
          <>
            <StockText kind="heading">{t("inventoryCosts.perBottleTitle")}</StockText>
            {summary.per_bottle.map(({ size_liters, count, amount }) => (
              <StockText key={size_liters}>{t("inventoryCosts.perBottle", { size: number(size_liters * 1000), count, amount: money(amount, currency) })}</StockText>
            ))}
            <StockText kind="muted">{t("inventoryCosts.perBottleHelp")}</StockText>
          </>
        ) : null}
        {Object.entries(summary.missing).filter(([, count]) => count > 0).map(([status, count]) => (
          <StockText key={status} kind="muted">{t(`inventoryCosts.missing.${status}`, { count })}</StockText>
        ))}
        {summary.short_lines ? <StockText kind="muted">{t("inventoryCosts.missing.short", { count: summary.short_lines })}</StockText> : null}
        {summary.excluded_lines && !allExcluded ? <StockText kind="muted">{t("inventoryCosts.excludedCount", { count: summary.excluded_lines })}</StockText> : null}
      </StockCard>
      {summary.lines.map((line) => {
        const excluded = line.status === "excluded";
        const choice = line.exclusion === "ingredient" ? exclusions.find((item) => matchesCostExclusion(
          { name: line.name, catalogReference: line.catalog_reference },
          [{ name: item.name, catalogReference: item.catalog_reference }]
        )) : undefined;
        return (
          <StockCard key={line.key}>
            <StockText kind="heading">{line.name}</StockText>
            <StockText>
              {line.quantity ? `${number(line.quantity.value)} ${t(`inventory.units.${line.quantity.unit}`)}` : t("inventoryCosts.noAmount")}
              {line.stock_name && line.stock_name !== line.name ? ` · ${t("inventoryCosts.fromStock", { name: line.stock_name })}` : ""}
            </StockText>
            {line.status === "priced" && line.cost !== null && line.currency ? (
              <StockText>{money(line.cost, line.currency)}</StockText>
            ) : (
              <StockText kind="muted">{t(line.exclusion === "use" ? "inventoryCosts.status.excludedUse" : `inventoryCosts.status.${line.status}`)}</StockText>
            )}
            {line.status === "priced" && line.unit_cost !== null && line.currency && line.unit ? (
              <StockText kind="muted">{t(line.unit === "units" ? "inventoryCosts.unitCostEach" : "inventoryCosts.unitCost", {
                cost: money(line.unit_cost, line.currency, true), unit: t(`inventory.units.${line.unit}`)
              })}</StockText>
            ) : null}
            {line.shortage ? <StockText kind="muted">{t("inventoryCosts.shortage", {
              amount: number(line.shortage.value), unit: t(`inventory.units.${line.shortage.unit}`)
            })}</StockText> : null}
            {!excluded && line.kind !== "PACKAGING" ? (
              <StockButton label={t("inventoryCosts.exclude")} disabled={busy}
                onPress={() => onExclusion({ action: "exclude", name: line.name, catalog_reference: line.catalog_reference })} />
            ) : choice ? (
              <StockButton label={t("inventoryCosts.include")} disabled={busy}
                onPress={() => onExclusion({ action: "include", id: choice.id })} />
            ) : null}
            {onUse && (!excluded || line.exclusion === "use") ? (
              <StockButton label={t(line.exclusion === "use" ? "inventoryCosts.includeUse" : "inventoryCosts.excludeUse")}
                disabled={busy} onPress={() => onUse(line.key, line.exclusion !== "use")} />
            ) : null}
          </StockCard>
        );
      })}
    </>
  );
}

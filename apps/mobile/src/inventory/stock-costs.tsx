import { useTranslation } from "react-i18next";

import type { InventoryStockHistoryResponse, InventoryStockItem } from "@meadtools/api-contract";

import { useCostFormat } from "./cost-format";
import { StockCard, StockHistoryRow, StockText } from "./stock-ui";

export function useStockCostLabel() {
  const { t } = useTranslation();
  const { money } = useCostFormat();
  return ({ cost, quantity }: InventoryStockItem) => {
    if (cost.unit_cost === null || !cost.currency) return t("inventoryCosts.noPrice");
    const amount = money(cost.unit_cost, cost.currency, true);
    return quantity.unit === "units" ? t("inventoryCosts.averageCostEach", { cost: amount }) :
      t("inventoryCosts.averageCost", { cost: amount, unit: t(`inventory.units.${quantity.unit}`) });
  };
}

export function StockPriceHistory({ history }: { history: InventoryStockHistoryResponse }) {
  const { t, i18n } = useTranslation();
  const { money, number } = useCostFormat();
  const date = new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium", timeStyle: "short" });
  const unit = history.stock.quantity.unit;
  function average(cost: InventoryStockItem["cost"]) {
    return cost.unit_cost === null || !cost.currency ? t("inventoryCosts.unknown") : money(cost.unit_cost, cost.currency, true);
  }
  if (!history.cost_events.length) return null;
  return (
    <>
      <StockText kind="heading">{t("inventoryCosts.priceHistory")}</StockText>
      <StockCard>
        {history.cost_events.map((event, index) => (
          <StockHistoryRow
            key={event.id}
            first={index === 0}
            title={t(event.kind === "valuation" ? "inventoryCosts.events.valuation" :
              event.price ? "inventoryCosts.events.pricedReceipt" : "inventoryCosts.events.unpricedReceipt")}
            details={[
              event.price ? t("inventoryCosts.events.price", {
                amount: money(event.price.amount, event.price.currency),
                quantity: number(event.price.per.value), unit: t(`inventory.units.${event.price.per.unit}`)
              }) : null,
              t(unit === "units" ? "inventoryCosts.events.averageEach" : "inventoryCosts.events.average", {
                before: average(event.before), after: average(event.after), unit: t(`inventory.units.${unit}`)
              }),
              date.format(new Date(event.created_at))
            ]}
            note={event.note}
          />
        ))}
      </StockCard>
    </>
  );
}

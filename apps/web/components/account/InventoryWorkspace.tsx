"use client";
import { InventoryAlertDialogContent as AlertDialogContent, InventoryDialogContent as DialogContent } from "./InventoryDialogContent";

import { useState } from "react";
import { organizeInventory } from "@meadtools/inventory-domain";
import { useInventoryView } from "@/hooks/useInventoryView";
import { InventoryOrganizationProvider, useInventoryOrganization } from "./InventoryOrganizationProvider";
import { InventoryOrganizationManager } from "./InventoryOrganizationManager";
import { InventoryViewControls } from "./InventoryViewControls";
import { InventoryOrganizeDialog } from "./InventoryOrganizeDialog";
import { InventoryOrganizationSummary, organizedItem } from "./InventoryOrganizationSummary";
import { InventoryReconcileDialog } from "./InventoryReconcileDialog";
import { InventoryTransferActions } from "./InventoryTransferActions";
import { InventoryCollectionTransfer } from "./InventoryCollectionTransfer";
import { PremiumCollectionNotice } from "./PremiumCollectionNotice";
import { FinishedMeadsWorkspace } from "./FinishedMeadsWorkspace";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useTranslation } from "react-i18next";
import { Plus, Package, History } from "lucide-react";
import type { InventoryStockItem } from "@meadtools/api-contract/contracts";
import { useInventory, useInventoryHistory, InventoryRequestError, type InventoryCommand } from "@/hooks/reactQuery/useInventory";
import { InventoryEditor, inventoryCategories, type InventoryAction } from "./InventoryEditor";
import { useCostExclusions, useInventoryCurrency } from "@/hooks/reactQuery/useInventoryCosts";
import { useMoney } from "./InventoryCostSummary";
import { CurrencyField } from "./InventoryPriceFields";
import { Label } from "@/components/ui/label";
import { DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";

export function InventoryWorkspace() {
  return <InventoryOrganizationProvider><InventoryWorkspaceContent /></InventoryOrganizationProvider>;
}
function InventoryWorkspaceContent() {
  const { t } = useTranslation();
  return <div className="space-y-6 pt-2 sm:pt-10">
    <header className="space-y-2"><h1 className="text-3xl font-bold tracking-tight">{t("inventory.title")}</h1><p className="max-w-xl text-sm text-muted-foreground">{t("inventory.description")}</p></header>
    <InventoryCollectionTransfer />
    <Tabs defaultValue="consumables">
      <TabsList aria-label={t("inventory.title")} className="grid h-auto w-full grid-cols-3 sm:inline-flex sm:w-auto"><TabsTrigger className="h-full whitespace-normal px-2 text-center text-xs sm:px-3 sm:text-sm" value="consumables">{t("inventory.consumables")}</TabsTrigger><TabsTrigger className="h-full whitespace-normal px-2 text-center text-xs sm:px-3 sm:text-sm" value="meads">{t("inventory.meads.title")}</TabsTrigger><TabsTrigger className="h-full whitespace-normal px-2 text-center text-xs sm:px-3 sm:text-sm" value="organization">{t("inventory.organization.manage")}</TabsTrigger></TabsList>
      <TabsContent value="consumables"><ConsumablesWorkspace /></TabsContent>
      <TabsContent value="meads"><FinishedMeadsWorkspace /></TabsContent>
      <TabsContent value="organization"><InventoryOrganizationManager /></TabsContent>
    </Tabs>
  </div>;
}

function ConsumablesWorkspace() {
  const { t, i18n } = useTranslation();
  const { overview, mutation } = useInventory();
  const currencyMutation = useInventoryCurrency();
  const exclusions = useCostExclusions(false);
  const { unitMoney } = useMoney();
  const [choosingCurrency, setChoosingCurrency] = useState(false);
  const organization = useInventoryOrganization();
  const [view, setView] = useInventoryView("consumables");
  const [organizing, setOrganizing] = useState<InventoryStockItem | null>(null);
  const [reconciling, setReconciling] = useState<string | null>(null);
  const [editor, setEditor] = useState<{ item: InventoryStockItem | null; action: InventoryAction } | null>(null);
  const [history, setHistory] = useState<InventoryStockItem | null>(null);
  const [removing, setRemoving] = useState<InventoryStockItem | null>(null);
  const format = (value: number) => new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 6 }).format(value);
  const failure = mutation.error ?? currencyMutation.error;
  const error = failure ? t(`inventory.errors.${failure instanceof InventoryRequestError ? failure.code : "FAILED"}`, t("inventory.saveError")) : "";
  async function save(command: InventoryCommand, close: () => void, currency: string | null = null) {
    try {
      // The first price also chooses the account currency.
      if (currency) await currencyMutation.mutateAsync(currency);
      await mutation.mutateAsync(command);
      close();
    } catch { /* Preserve input and operation ID for retry. */ }
  }
  function open(item: InventoryStockItem | null, action: InventoryAction = "receipt") { mutation.reset(); currencyMutation.reset(); setEditor({ item, action }); }
  const data = overview.data;
  if (overview.isPending || organization.overview.isPending) return <p role="status" className="py-12 text-center text-muted-foreground">{t("inventory.loading")}</p>;
  if (overview.isError || !data || organization.overview.isError) return <div role="alert" className="space-y-3 py-12 text-center"><p>{t("inventory.loadError")}</p><Button variant="outline" onClick={() => { void overview.refetch(); void organization.overview.refetch(); }}>{t("equipment.retry")}</Button></div>;
  const ordered = organizeInventory(data.stock.map((item) => organizedItem(organization.overview.data, "stock", { ...item, type: item.category })), view);
  const byId = new Map(data.stock.map((item) => [item.id, item]));
  const visible = ordered.map((row) => byId.get(row.id)!);
  return <section className="space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-4 pt-4">
      <div className="space-y-2"><h2 className="text-xl font-semibold">{t("inventory.consumables")}</h2><p className="max-w-xl text-sm text-muted-foreground">{t("inventory.consumablesDescription")}</p></div>
      {data.can_manage ? <Button onClick={() => open(null)}><Plus aria-hidden className="mr-2 h-4 w-4" />{t("inventory.add")}</Button> : null}
    </div>

    <Accordion type="single" collapsible className="border-t">
      <AccordionItem value="inventory-transfer">
        <AccordionTrigger className="text-base font-semibold">{t("inventory.transfer.sectionTitle")}</AccordionTrigger>
        <AccordionContent>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl space-y-2">
              <p className="text-sm text-muted-foreground">{t(data.can_manage ? "inventory.transfer.importHelp" : "inventory.transfer.importPremiumHelp")}</p>
              <p className="text-sm text-muted-foreground">{t("inventory.transfer.exportHelp")}</p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <InventoryTransferActions canManage={data.can_manage} stock={data.stock} />
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>

    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
      <span className="text-muted-foreground">{data.currency ? t("inventoryCosts.currencyCurrent", { currency: data.currency }) : t("inventoryCosts.currencyUnset")}</span>
      {data.can_manage ? <Button size="sm" variant="ghost" onClick={() => { currencyMutation.reset(); setChoosingCurrency(true); }}>{t(data.currency ? "inventoryCosts.currencyChange" : "inventoryCosts.currencyChoose")}</Button> : null}
    </div>
    {data.cost_exclusions.length ? <div className="space-y-2 text-sm">
      <p className="text-muted-foreground">{t("inventoryCosts.excludedListHelp")}</p>
      <ul aria-label={t("inventoryCosts.excludedListLabel")} className="flex flex-wrap gap-2">
        {data.cost_exclusions.map((exclusion) => <li key={exclusion.id} className="flex items-center gap-1 rounded-md border py-1 pl-3 pr-1">
          <span className="break-words">{exclusion.name}</span>
          <Button size="sm" variant="ghost" className="h-7 px-2" disabled={exclusions.mutation.isPending}
            aria-label={t("inventoryCosts.includeNamed", { name: exclusion.name })}
            onClick={() => exclusions.mutation.mutate({ action: "include", id: exclusion.id })}>{t("inventoryCosts.include")}</Button>
        </li>)}
      </ul>
      {exclusions.mutation.isError ? <p role="alert" className="text-destructive">{t("inventory.saveError")}</p> : null}
    </div> : null}

    <InventoryViewControls view={view} setView={setView} organization={organization.overview.data} types={inventoryCategories} />
    <PremiumCollectionNotice key={String(data.can_manage)} canManage={data.can_manage} description={t("inventory.readOnly")}>
      {visible.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{visible.map((item) => <Card key={item.id} className="flex min-w-0 flex-col">
        <CardHeader><p className="text-xs text-muted-foreground">{t(`inventory.categories.${item.category}`)}</p><CardTitle className="break-words text-base">{item.name}</CardTitle></CardHeader>
        <CardContent className="flex flex-1 flex-col gap-4">
          <p className="text-2xl font-semibold tabular-nums">{format(item.quantity.value)} <span className="text-base font-normal text-muted-foreground">{t(`inventory.units.${item.quantity.unit}`)}</span></p>
          <p className="text-sm text-muted-foreground">{item.cost.unit_cost !== null && item.cost.currency
            ? item.quantity.unit === "units"
              ? t("inventoryCosts.averageCostEach", { cost: unitMoney(item.cost.unit_cost, item.cost.currency) })
              : t("inventoryCosts.averageCost", { cost: unitMoney(item.cost.unit_cost, item.cost.currency), unit: t(`inventory.units.${item.quantity.unit}`) })
            : t("inventoryCosts.noPrice")}</p>
          <InventoryOrganizationSummary kind="stock" id={item.id} />
          {item.notes ? <p className="break-words text-sm text-muted-foreground">{item.notes}</p> : null}
          {item.reconciliation_required ? <div className="space-y-3 rounded-md border p-3 text-sm"><p>{t("inventory.needsReview")}</p>
            {data.can_manage ? <Button variant="outline" size="sm" onClick={() => { mutation.reset(); setReconciling(item.id); }}>{t("inventory.reconcile.title")}</Button> : null}
          </div> : null}
          <div className="mt-auto flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => { organization.mutation.reset(); setOrganizing(item); }}>{t(data.can_manage ? "inventory.organization.organize" : "inventory.organization.storageHistory")}</Button>{data.can_manage ? <><Button size="sm" variant="outline" onClick={() => open(item, "details")}>{t("inventory.actions.details")}</Button><Button size="sm" variant="outline" onClick={() => open(item, "receipt")}>{t("inventory.actions.receipt")}</Button><Button size="sm" variant="outline" onClick={() => open(item, "manual_use")}>{t("inventory.actions.manual_use")}</Button><Button size="sm" variant="outline" onClick={() => open(item, "set_unit_cost")}>{t("inventory.actions.set_unit_cost")}</Button><Button size="sm" variant="ghost" onClick={() => open(item, "correction")}>{t("inventory.actions.correction")}</Button></> : null}
            <Button size="sm" variant="ghost" onClick={() => setHistory(item)} aria-label={t("inventory.historyNamed", { name: item.name })}><History aria-hidden className="mr-1 h-4 w-4" />{t("inventory.history")}</Button>
            {data.can_manage ? <Button size="sm" variant="ghost" onClick={() => { mutation.reset(); setRemoving(item); }} aria-label={t("inventory.removeNamed", { name: item.name })}>{t("equipment.remove")}</Button> : null}
          </div>
        </CardContent>
      </Card>)}</div> : <div className="rounded-xl border border-dashed p-12 text-center"><Package aria-hidden className="mx-auto mb-3 h-8 w-8 text-muted-foreground" /><h2 className="font-semibold">{t(data.stock.length ? "inventory.noMatches" : "inventory.emptyTitle")}</h2><p className="mt-2 text-sm text-muted-foreground">{t(data.stock.length ? "inventory.changeSearch" : "inventory.emptyDescription")}</p></div>}
    </PremiumCollectionNotice>
    {organizing ? <InventoryOrganizeDialog kind="stock" id={organizing.id} name={organizing.name} onClose={() => { setOrganizing(null); void organization.overview.refetch(); }} /> : null}
    {editor && data.can_manage ? <InventoryEditor key={`${editor.item?.id ?? "new"}-${editor.action}`} item={editor.item} action={editor.action} busy={mutation.isPending || currencyMutation.isPending} error={error} currency={data.currency} onClose={() => setEditor(null)} onSave={(command, currency) => save(command, () => setEditor(null), currency)} /> : null}
    {choosingCurrency && data.can_manage ? <CurrencyDialog current={data.currency} busy={currencyMutation.isPending} error={currencyMutation.error ? error : ""} onClose={() => setChoosingCurrency(false)} onSave={async (currency) => { try { await currencyMutation.mutateAsync(currency); setChoosingCurrency(false); } catch { /* Keep the dialog open to retry. */ } }} /> : null}
    {reconciling && data.can_manage ? <InventoryReconcileDialog stockId={reconciling} busy={mutation.isPending} error={error} onClose={() => setReconciling(null)} onSave={(command) => save(command, () => setReconciling(null))} /> : null}
    {history ? <InventoryHistory item={history} onClose={() => setHistory(null)} /> : null}
    {removing && data.can_manage ? <AlertDialog open onOpenChange={(value) => { if (!value && !mutation.isPending) setRemoving(null); }}><AlertDialogContent>
      <AlertDialogHeader><AlertDialogTitle>{t("inventory.removeTitle")}</AlertDialogTitle><AlertDialogDescription>{t("inventory.removeDescription", { name: removing.name })}</AlertDialogDescription></AlertDialogHeader>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      <AlertDialogFooter><AlertDialogCancel disabled={mutation.isPending}>{t("equipment.cancel")}</AlertDialogCancel><AlertDialogAction asChild onClick={(event) => event.preventDefault()}><LoadingButton variant="destructive" loading={mutation.isPending} loadingText={t("equipment.saving")} onClick={() => void save({ id: removing.id, change: { action: "archive" } }, () => setRemoving(null))}>{t("equipment.remove")}</LoadingButton></AlertDialogAction></AlertDialogFooter>
    </AlertDialogContent></AlertDialog> : null}
  </section>;
}

function CurrencyDialog({ current, busy, error, onClose, onSave }: { current: string | null; busy: boolean; error: string; onClose: () => void; onSave: (currency: string) => Promise<void> }) {
  const { t } = useTranslation();
  const [currency, setCurrency] = useState<string | null>(current);
  return <Dialog open onOpenChange={(value) => { if (!value && !busy) onClose(); }}><DialogContent>
    <DialogHeader><DialogTitle>{t("inventoryCosts.currency")}</DialogTitle><DialogDescription>{t("inventoryCosts.currencyHelp")}</DialogDescription></DialogHeader>
    <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); if (currency) void onSave(currency); }}>
      <div className="space-y-2"><Label htmlFor="inventory-currency">{t("inventoryCosts.currency")}</Label><CurrencyField id="inventory-currency" value={currency} onChange={setCurrency} disabled={busy} /></div>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      <DialogFooter><Button type="button" variant="outline" disabled={busy} onClick={onClose}>{t("equipment.cancel")}</Button><LoadingButton type="submit" loading={busy} loadingText={t("equipment.saving")} disabled={!currency || currency === current}>{t("inventory.save")}</LoadingButton></DialogFooter>
    </form>
  </DialogContent></Dialog>;
}

function InventoryHistory({ item, onClose }: { item: InventoryStockItem; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const { unitMoney } = useMoney();
  const query = useInventoryHistory(item.id);
  const number = (value: number) => new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 6, signDisplay: "exceptZero" }).format(value);
  return <Dialog open onOpenChange={(value) => { if (!value) onClose(); }}><DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
    <DialogHeader><DialogTitle>{t("inventory.history")}</DialogTitle><DialogDescription>{item.name}</DialogDescription></DialogHeader>
    {query.isPending ? <p role="status">{t("inventory.loading")}</p> : query.isError ? <div role="alert"><p>{t("inventory.loadError")}</p><Button variant="outline" onClick={() => void query.refetch()}>{t("equipment.retry")}</Button></div> : query.data ? <>
      {query.data.adjustments.length ? <ol className="space-y-4">{query.data.adjustments.map((adjustment) => <li key={adjustment.id} className="space-y-1 border-b pb-4 last:border-0">
        <div className="flex flex-wrap justify-between gap-2 text-sm"><span className="font-medium">{t(`inventory.kinds.${adjustment.kind}`, t("inventory.stockChange"))}</span><time dateTime={adjustment.created_at} className="text-muted-foreground">{new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium", timeStyle: "short" }).format(new Date(adjustment.created_at))}</time></div>
        <p>{number(adjustment.delta)} {t(`inventory.units.${adjustment.balance_after.unit}`)}</p><p className="text-sm text-muted-foreground">{t("inventory.balanceAfter", { value: new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 6 }).format(adjustment.balance_after.value), unit: t(`inventory.units.${adjustment.balance_after.unit}`) })}</p>
        {adjustment.note ? <p className="break-words text-sm">{adjustment.note}</p> : null}
      </li>)}</ol> : <p>{t("inventory.noHistory")}</p>}
      {query.data.has_more ? <p className="text-sm text-muted-foreground">{t("inventory.recentHistory")}</p> : null}
      {query.data.cost_events.length ? <section className="space-y-3 border-t pt-4"><h3 className="font-semibold">{t("inventoryCosts.priceHistory")}</h3><ol className="space-y-3">{query.data.cost_events.map((event) => <li key={event.id} className="space-y-1 text-sm">
        <div className="flex flex-wrap justify-between gap-2"><span className="font-medium">{t(event.kind === "valuation" ? "inventoryCosts.events.valuation" : event.price ? "inventoryCosts.events.pricedReceipt" : "inventoryCosts.events.unpricedReceipt")}</span><time dateTime={event.created_at} className="text-muted-foreground">{new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium", timeStyle: "short" }).format(new Date(event.created_at))}</time></div>
        {event.price ? <p>{t("inventoryCosts.events.price", { amount: unitMoney(event.price.amount, event.price.currency), quantity: new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 6 }).format(event.price.per.value), unit: t(`inventory.units.${event.price.per.unit}`) })}</p> : null}
        <p className="text-muted-foreground">{t(item.quantity.unit === "units" ? "inventoryCosts.events.averageEach" : "inventoryCosts.events.average", {
          before: event.before.unit_cost !== null && event.before.currency ? unitMoney(event.before.unit_cost, event.before.currency) : t("inventoryCosts.unknown"),
          after: event.after.unit_cost !== null && event.after.currency ? unitMoney(event.after.unit_cost, event.after.currency) : t("inventoryCosts.unknown"),
          unit: t(`inventory.units.${item.quantity.unit}`),
        })}</p>
        {event.note ? <p className="break-words">{event.note}</p> : null}
      </li>)}</ol></section> : null}
    </> : null}
  </DialogContent></Dialog>;
}

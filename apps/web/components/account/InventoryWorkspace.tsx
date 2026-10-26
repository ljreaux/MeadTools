"use client";

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
import { PremiumCollectionNotice } from "./PremiumCollectionNotice";
import { FinishedMeadsWorkspace } from "./FinishedMeadsWorkspace";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useTranslation } from "react-i18next";
import { Plus, Package, History } from "lucide-react";
import type { InventoryStockItem } from "@meadtools/api-contract/contracts";
import { useInventory, useInventoryHistory, InventoryRequestError, type InventoryCommand } from "@/hooks/reactQuery/useInventory";
import { InventoryEditor, inventoryCategories, type InventoryAction } from "./InventoryEditor";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";

export function InventoryWorkspace() {
  return <InventoryOrganizationProvider><InventoryWorkspaceContent /></InventoryOrganizationProvider>;
}
function InventoryWorkspaceContent() {
  const { t } = useTranslation();
  return <div className="space-y-6 pt-2 sm:pt-10">
    <header className="space-y-2"><h1 className="text-3xl font-bold tracking-tight">{t("inventory.title")}</h1><p className="max-w-xl text-sm text-muted-foreground">{t("inventory.description")}</p></header>
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
  const organization = useInventoryOrganization();
  const [view, setView] = useInventoryView("consumables");
  const [organizing, setOrganizing] = useState<InventoryStockItem | null>(null);
  const [reconciling, setReconciling] = useState<string | null>(null);
  const [editor, setEditor] = useState<{ item: InventoryStockItem | null; action: InventoryAction } | null>(null);
  const [history, setHistory] = useState<InventoryStockItem | null>(null);
  const [removing, setRemoving] = useState<InventoryStockItem | null>(null);
  const format = (value: number) => new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 6 }).format(value);
  const error = mutation.error ? t(`inventory.errors.${mutation.error instanceof InventoryRequestError ? mutation.error.code : "FAILED"}`, t("inventory.saveError")) : "";
  async function save(command: InventoryCommand, close: () => void) {
    try { await mutation.mutateAsync(command); close(); } catch { /* Preserve input and operation ID for retry. */ }
  }
  function open(item: InventoryStockItem | null, action: InventoryAction = "receipt") { mutation.reset(); setEditor({ item, action }); }
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

    <InventoryViewControls view={view} setView={setView} organization={organization.overview.data} types={inventoryCategories} />
    <PremiumCollectionNotice key={String(data.can_manage)} canManage={data.can_manage} description={t("inventory.readOnly")}>
      {visible.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{visible.map((item) => <Card key={item.id} className="flex min-w-0 flex-col">
        <CardHeader><p className="text-xs text-muted-foreground">{t(`inventory.categories.${item.category}`)}</p><CardTitle className="break-words text-base">{item.name}</CardTitle></CardHeader>
        <CardContent className="flex flex-1 flex-col gap-4">
          <p className="text-2xl font-semibold tabular-nums">{format(item.quantity.value)} <span className="text-base font-normal text-muted-foreground">{t(`inventory.units.${item.quantity.unit}`)}</span></p>
          <InventoryOrganizationSummary kind="stock" id={item.id} />
          {item.notes ? <p className="break-words text-sm text-muted-foreground">{item.notes}</p> : null}
          {item.reconciliation_required ? <div className="space-y-3 rounded-md border p-3 text-sm"><p>{t("inventory.needsReview")}</p>
            {data.can_manage ? <Button variant="outline" size="sm" onClick={() => { mutation.reset(); setReconciling(item.id); }}>{t("inventory.reconcile.title")}</Button> : null}
          </div> : null}
          <div className="mt-auto flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => { organization.mutation.reset(); setOrganizing(item); }}>{t(data.can_manage ? "inventory.organization.organize" : "inventory.organization.storageHistory")}</Button>{data.can_manage ? <><Button size="sm" variant="outline" onClick={() => open(item, "details")}>{t("inventory.actions.details")}</Button><Button size="sm" variant="outline" onClick={() => open(item, "receipt")}>{t("inventory.actions.receipt")}</Button><Button size="sm" variant="outline" onClick={() => open(item, "manual_use")}>{t("inventory.actions.manual_use")}</Button><Button size="sm" variant="ghost" onClick={() => open(item, "correction")}>{t("inventory.actions.correction")}</Button></> : null}
            <Button size="sm" variant="ghost" onClick={() => setHistory(item)} aria-label={t("inventory.historyNamed", { name: item.name })}><History aria-hidden className="mr-1 h-4 w-4" />{t("inventory.history")}</Button>
            {data.can_manage ? <Button size="sm" variant="ghost" onClick={() => { mutation.reset(); setRemoving(item); }} aria-label={t("inventory.removeNamed", { name: item.name })}>{t("equipment.remove")}</Button> : null}
          </div>
        </CardContent>
      </Card>)}</div> : <div className="rounded-xl border border-dashed p-12 text-center"><Package aria-hidden className="mx-auto mb-3 h-8 w-8 text-muted-foreground" /><h2 className="font-semibold">{t(data.stock.length ? "inventory.noMatches" : "inventory.emptyTitle")}</h2><p className="mt-2 text-sm text-muted-foreground">{t(data.stock.length ? "inventory.changeSearch" : "inventory.emptyDescription")}</p></div>}
    </PremiumCollectionNotice>
    {organizing ? <InventoryOrganizeDialog kind="stock" id={organizing.id} name={organizing.name} onClose={() => { setOrganizing(null); void organization.overview.refetch(); }} /> : null}
    {editor && data.can_manage ? <InventoryEditor key={`${editor.item?.id ?? "new"}-${editor.action}`} item={editor.item} action={editor.action} busy={mutation.isPending} error={error} onClose={() => setEditor(null)} onSave={(command) => save(command, () => setEditor(null))} /> : null}
    {reconciling && data.can_manage ? <InventoryReconcileDialog stockId={reconciling} busy={mutation.isPending} error={error} onClose={() => setReconciling(null)} onSave={(command) => save(command, () => setReconciling(null))} /> : null}
    {history ? <InventoryHistory item={history} onClose={() => setHistory(null)} /> : null}
    {removing && data.can_manage ? <AlertDialog open onOpenChange={(value) => { if (!value && !mutation.isPending) setRemoving(null); }}><AlertDialogContent>
      <AlertDialogHeader><AlertDialogTitle>{t("inventory.removeTitle")}</AlertDialogTitle><AlertDialogDescription>{t("inventory.removeDescription", { name: removing.name })}</AlertDialogDescription></AlertDialogHeader>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      <AlertDialogFooter><AlertDialogCancel disabled={mutation.isPending}>{t("equipment.cancel")}</AlertDialogCancel><AlertDialogAction asChild onClick={(event) => event.preventDefault()}><LoadingButton variant="destructive" loading={mutation.isPending} loadingText={t("equipment.saving")} onClick={() => void save({ id: removing.id, change: { action: "archive" } }, () => setRemoving(null))}>{t("equipment.remove")}</LoadingButton></AlertDialogAction></AlertDialogFooter>
    </AlertDialogContent></AlertDialog> : null}
  </section>;
}

function InventoryHistory({ item, onClose }: { item: InventoryStockItem; onClose: () => void }) {
  const { t, i18n } = useTranslation();
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
    </> : null}
  </DialogContent></Dialog>;
}

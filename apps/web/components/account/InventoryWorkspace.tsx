"use client";

import { useId, useState } from "react";
import { PremiumCollectionNotice } from "./PremiumCollectionNotice";
import { useTranslation } from "react-i18next";
import { Plus, Search, X, Package, History } from "lucide-react";
import type { InventoryStockItem } from "@meadtools/api-contract/contracts";
import { useInventory, useInventoryHistory, InventoryRequestError, type InventoryCommand } from "@/hooks/reactQuery/useInventory";
import { InventoryEditor, inventoryCategories, type InventoryAction } from "./InventoryEditor";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InputGroup, InputGroupInput, InputGroupAddon, InputGroupButton } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";

export function InventoryWorkspace() {
  const { t, i18n } = useTranslation();
  const { overview, mutation } = useInventory();
  const filterId = useId();
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
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
  if (overview.isPending) return <p role="status" className="py-12 text-center text-muted-foreground">{t("inventory.loading")}</p>;
  if (overview.isError || !data) return <div role="alert" className="space-y-3 py-12 text-center"><p>{t("inventory.loadError")}</p><Button variant="outline" onClick={() => void overview.refetch()}>{t("equipment.retry")}</Button></div>;
  const visible = data.stock.filter((item) => (filter === "all" || item.category === filter) && `${item.name} ${item.notes ?? ""}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  return <section className="space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-4 pt-2 sm:pt-10">
      <div className="space-y-2"><h1 className="text-3xl font-bold tracking-tight">{t("inventory.title")}</h1><p className="max-w-xl text-sm text-muted-foreground">{t("inventory.description")}</p></div>
      {data.can_manage ? <Button onClick={() => open(null)}><Plus aria-hidden className="mr-2 h-4 w-4" />{t("inventory.add")}</Button> : null}
    </div>

    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Label htmlFor={filterId} className="text-muted-foreground">{t("inventory.category")}</Label>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger id={filterId} className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("inventory.all")}</SelectItem>
            {inventoryCategories.map((category) => <SelectItem key={category} value={category}>{t(`inventory.categories.${category}`)}</SelectItem>)}
          </SelectContent>
        </Select>
        {filter !== "all" ? <Button type="button" variant="ghost" size="sm" onClick={() => setFilter("all")}><X aria-hidden className="h-4 w-4" />{t("brews.filters.clear", "Clear filters")}</Button> : null}
      </div>
      <InputGroup className="w-full sm:max-w-sm"><InputGroupInput className="[&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none" type="search" value={search} onChange={(event) => setSearch(event.target.value)} aria-label={t("inventory.search")} placeholder={t("inventory.search")} /><InputGroupAddon><Search aria-hidden /></InputGroupAddon>
        {search ? <InputGroupAddon align="inline-end"><InputGroupButton aria-label={t("clear")} onClick={() => setSearch("")}><X aria-hidden /></InputGroupButton></InputGroupAddon> : null}
      </InputGroup>
    </div>
    <PremiumCollectionNotice key={String(data.can_manage)} canManage={data.can_manage} description={t("inventory.readOnly")}>
      {visible.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{visible.map((item) => <Card key={item.id} className="flex min-w-0 flex-col">
        <CardHeader><p className="text-xs text-muted-foreground">{t(`inventory.categories.${item.category}`)}</p><CardTitle className="break-words text-base">{item.name}</CardTitle></CardHeader>
        <CardContent className="flex flex-1 flex-col gap-4">
          <p className="text-2xl font-semibold tabular-nums">{format(item.quantity.value)} <span className="text-base font-normal text-muted-foreground">{t(`inventory.units.${item.quantity.unit}`)}</span></p>
          {item.notes ? <p className="break-words text-sm text-muted-foreground">{item.notes}</p> : null}
          {item.reconciliation_required ? <p className="rounded-md border p-3 text-sm">{t("inventory.needsReview")}</p> : null}
          <div className="mt-auto flex flex-wrap gap-2">
            {data.can_manage ? <><Button size="sm" variant="outline" onClick={() => open(item, "details")}>{t("inventory.actions.details")}</Button><Button size="sm" variant="outline" onClick={() => open(item, "receipt")}>{t("inventory.actions.receipt")}</Button><Button size="sm" variant="outline" onClick={() => open(item, "manual_use")}>{t("inventory.actions.manual_use")}</Button><Button size="sm" variant="ghost" onClick={() => open(item, "correction")}>{t("inventory.actions.correction")}</Button></> : null}
            <Button size="sm" variant="ghost" onClick={() => setHistory(item)} aria-label={t("inventory.historyNamed", { name: item.name })}><History aria-hidden className="mr-1 h-4 w-4" />{t("inventory.history")}</Button>
            {data.can_manage ? <Button size="sm" variant="ghost" onClick={() => { mutation.reset(); setRemoving(item); }} aria-label={t("inventory.removeNamed", { name: item.name })}>{t("equipment.remove")}</Button> : null}
          </div>
        </CardContent>
      </Card>)}</div> : <div className="rounded-xl border border-dashed p-12 text-center"><Package aria-hidden className="mx-auto mb-3 h-8 w-8 text-muted-foreground" /><h2 className="font-semibold">{t(data.stock.length ? "inventory.noMatches" : "inventory.emptyTitle")}</h2><p className="mt-2 text-sm text-muted-foreground">{t(data.stock.length ? "inventory.changeSearch" : "inventory.emptyDescription")}</p></div>}
    </PremiumCollectionNotice>
    {editor && data.can_manage ? <InventoryEditor key={`${editor.item?.id ?? "new"}-${editor.action}`} item={editor.item} action={editor.action} busy={mutation.isPending} error={error} onClose={() => setEditor(null)} onSave={(command) => save(command, () => setEditor(null))} /> : null}
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

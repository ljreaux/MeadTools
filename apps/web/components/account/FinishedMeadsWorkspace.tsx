"use client";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Search, X, Wine, History } from "lucide-react";
import { finishedMeadTotals } from "@meadtools/inventory-domain";
import type { FinishedMeadItem } from "@meadtools/api-contract/contracts";
import { useFinishedMeads, type FinishedMeadCommand } from "@/hooks/reactQuery/useFinishedMeads";
import { InventoryRequestError } from "@/hooks/reactQuery/useInventory";
import { FinishedMeadEditor, type FinishedMeadAction } from "./FinishedMeadEditor";
import { FinishedMeadHistory } from "./FinishedMeadHistory";
import { PremiumCollectionNotice } from "./PremiumCollectionNotice";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { InputGroup, InputGroupInput, InputGroupAddon, InputGroupButton } from "@/components/ui/input-group";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";

export function FinishedMeadsWorkspace() {
  const { t, i18n } = useTranslation();
  const { overview, mutation } = useFinishedMeads();
  const [search, setSearch] = useState("");
  const [editor, setEditor] = useState<{ item: FinishedMeadItem | null; action: FinishedMeadAction } | null>(null);
  const [history, setHistory] = useState<FinishedMeadItem | null>(null);
  const [removing, setRemoving] = useState<FinishedMeadItem | null>(null);
  const format = (value: number) => new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 3 }).format(value);
  const errorCode = mutation.error instanceof InventoryRequestError ? mutation.error.code : "FAILED";
  const error = mutation.error ? t(`inventory.meads.errors.${errorCode}`, t(`inventory.errors.${errorCode}`, t("inventory.saveError"))) : "";
  function open(item: FinishedMeadItem | null, action: FinishedMeadAction = "receipt") { mutation.reset(); setEditor({ item, action }); }
  async function save(command: FinishedMeadCommand, close: () => void) {
    try { await mutation.mutateAsync(command); close(); }
    catch { /* Keep the reviewed revision and operation identity for a safe retry. */ }
  }
  const data = overview.data;
  if (overview.isPending) return <p role="status" className="py-12 text-center text-muted-foreground">{t("inventory.loading")}</p>;
  if (overview.isError || !data) return <div role="alert" className="space-y-3 py-12 text-center"><p>{t("inventory.loadError")}</p><Button variant="outline" onClick={() => void overview.refetch()}>{t("equipment.retry")}</Button></div>;
  const visible = data.meads.filter((mead) => `${mead.name} ${mead.notes ?? ""}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  return <section className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-4 pt-4">
      <div className="space-y-2"><h2 className="text-xl font-semibold">{t("inventory.meads.title")}</h2><p className="max-w-xl text-sm text-muted-foreground">{t("inventory.meads.description")}</p></div>
      {data.can_manage ? <Button onClick={() => open(null)}><Plus aria-hidden className="mr-2 h-4 w-4" />{t("inventory.meads.add")}</Button> : null}
    </div>
    <InputGroup className="w-full sm:max-w-sm"><InputGroupInput type="search" value={search} onChange={(event) => setSearch(event.target.value)} aria-label={t("inventory.meads.search")} placeholder={t("inventory.meads.search")} /><InputGroupAddon><Search aria-hidden /></InputGroupAddon>
      {search ? <InputGroupAddon align="inline-end"><InputGroupButton aria-label={t("clear")} onClick={() => setSearch("")}><X aria-hidden /></InputGroupButton></InputGroupAddon> : null}
    </InputGroup>
    <PremiumCollectionNotice key={String(data.can_manage)} canManage={data.can_manage} description={t("inventory.readOnly")}>
      {visible.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{visible.map((mead) => {
        const totals = finishedMeadTotals(mead.bottles);
        return <Card key={mead.id} className="flex min-w-0 flex-col">
          <CardHeader><CardTitle className="break-words text-base">{mead.name}</CardTitle></CardHeader>
          <CardContent className="flex flex-1 flex-col gap-4">
            <div><p className="text-2xl font-semibold tabular-nums">{t("inventory.meads.bottleCount", { count: totals.bottles })}</p><p className="text-sm text-muted-foreground">{t("inventory.meads.totalVolume", { volume: format(totals.liters) })}</p></div>
            <ul className="space-y-2">{mead.bottles.map((bottle) => <li key={bottle.id} className="flex flex-wrap justify-between gap-2 border-b pb-2 text-sm"><span>{format(bottle.size_liters * 1000)} mL</span><span className="tabular-nums">{t("inventory.meads.remaining", { count: bottle.quantity })}</span></li>)}</ul>
            {mead.notes ? <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{mead.notes}</p> : null}
            <div className="mt-auto flex flex-wrap gap-2">
              {data.can_manage ? <><Button size="sm" variant="outline" onClick={() => open(mead, "receipt")}>{t("inventory.meads.actions.receipt")}</Button><Button size="sm" variant="outline" onClick={() => open(mead, "manual_use")}>{t("inventory.meads.actions.manual_use")}</Button><Button size="sm" variant="ghost" onClick={() => open(mead, "correction")}>{t("inventory.meads.actions.correction")}</Button><Button size="sm" variant="ghost" onClick={() => open(mead, "details")}>{t("inventory.meads.actions.details")}</Button></> : null}
              <Button size="sm" variant="ghost" onClick={() => setHistory(mead)} aria-label={t("inventory.historyNamed", { name: mead.name })}><History aria-hidden className="mr-1 h-4 w-4" />{t("inventory.history")}</Button>
              {data.can_manage ? <Button size="sm" variant="ghost" onClick={() => { mutation.reset(); setRemoving(mead); }}>{t("inventory.meads.archive")}</Button> : null}
            </div>
          </CardContent>
        </Card>;
      })}</div> : <div className="rounded-xl border border-dashed p-12 text-center"><Wine aria-hidden className="mx-auto mb-3 h-8 w-8 text-muted-foreground" /><h3 className="font-semibold">{t(data.meads.length ? "inventory.noMatches" : "inventory.meads.emptyTitle")}</h3><p className="mt-2 text-sm text-muted-foreground">{t(data.meads.length ? "inventory.changeSearch" : "inventory.meads.emptyDescription")}</p></div>}
    </PremiumCollectionNotice>
    {editor && data.can_manage ? <FinishedMeadEditor key={`${editor.item?.id ?? "new"}-${editor.action}`} {...editor} busy={mutation.isPending} error={error} onClose={() => { setEditor(null); void overview.refetch(); }} onSave={(command) => save(command, () => setEditor(null))} /> : null}
    {history ? <FinishedMeadHistory item={history} onClose={() => setHistory(null)} /> : null}
    {removing && data.can_manage ? <AlertDialog open onOpenChange={(open) => { if (!open && !mutation.isPending) setRemoving(null); }}><AlertDialogContent>
      <AlertDialogHeader><AlertDialogTitle>{t("inventory.meads.archiveTitle")}</AlertDialogTitle><AlertDialogDescription>{t("inventory.meads.archiveDescription", { name: removing.name })}</AlertDialogDescription></AlertDialogHeader>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      <AlertDialogFooter><AlertDialogCancel disabled={mutation.isPending}>{t("equipment.cancel")}</AlertDialogCancel><AlertDialogAction asChild onClick={(event) => event.preventDefault()}><LoadingButton loading={mutation.isPending} loadingText={t("equipment.saving")} onClick={() => void save({ id: removing.id, change: { action: "archive", expected_revision: removing.revision } }, () => setRemoving(null))}>{t("inventory.meads.archive")}</LoadingButton></AlertDialogAction></AlertDialogFooter>
    </AlertDialogContent></AlertDialog> : null}
  </section>;
}

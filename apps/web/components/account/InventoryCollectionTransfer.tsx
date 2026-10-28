"use client";
import { useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { CollectionWorkbookError, collectionFromSheets, FILE_BYTE_LIMIT, type InventoryCollection } from "@meadtools/inventory-domain";
import { inventoryTransferResponseSchema } from "@meadtools/api-contract/inventory";
import type { InventoryTransferRequestBody } from "@meadtools/api-contract/contracts";
import { useFetchWithAuth } from "@/hooks/auth/useFetchWithAuth";
import { formatStoredBottleSize } from "@/lib/utils/bottleUnits";
import { useInventoryOrganization } from "./InventoryOrganizationProvider";
import { downloadTransferFile, transferErrorCode } from "./InventoryTransferActions";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/Checkbox";
import { toast } from "@/hooks/use-toast";

export function InventoryCollectionTransfer() {
  const { t, i18n } = useTranslation();
  const organization = useInventoryOrganization();
  const canManage = organization.overview.data?.can_manage ?? false;
  const fetchWithAuth = useFetchWithAuth();
  const client = useQueryClient();
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [review, setReview] = useState<InventoryCollection | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const attempt = useRef<string | null>(null);
  const [error, setError] = useState("");
  function report(error: unknown) {
    return t(`inventory.transfer.errors.${transferErrorCode(error) ?? "FAILED"}`, t("inventory.transfer.errors.FAILED"));
  }
  async function request(body: InventoryTransferRequestBody) {
    return inventoryTransferResponseSchema.parse(await fetchWithAuth("/api/account/inventory/transfer", { method: "POST", body: JSON.stringify(body) }));
  }
  async function refresh() {
    await Promise.all(["inventory", "finished-meads", "inventory-organization", "brew-inventory"].map(key => client.invalidateQueries({ queryKey: ["account", key] })));
  }
  function close() {
    if (inFlight.current) return;
    setOpen(false); setReview(null); setFile(null); setError(""); setAcknowledged(false); setPage(0); attempt.current = null;
    requestAnimationFrame(() => trigger.current?.focus());
  }
  async function download(template: boolean) {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true);
    try {
      const response = await request({ action: "export_collection", template });
      if (response.kind !== "file") throw new Error();
      downloadTransferFile(response);
    } catch (error) { toast({ variant: "destructive", description: report(error) }); }
    finally { inFlight.current = false; setBusy(false); }
  }
  async function inspect() {
    if (!file || inFlight.current) return;
    if (file.size > FILE_BYTE_LIMIT) { setError(t("inventory.transfer.errors.IMPORT_LIMIT")); return; }
    inFlight.current = true; setBusy(true); setError("");
    try {
      const content = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(",")[1]); reader.onerror = () => reject(new Error()); reader.readAsDataURL(file);
      });
      const response = await request({ action: "inspect", filename: file.name, content, delimiter: "auto" });
      if (response.kind !== "sheets") throw new Error();
      try { setReview(collectionFromSheets(response.sheets)); }
      catch (error) {
        const context = error instanceof CollectionWorkbookError && error.sheet ? t("inventory.collectionTransfer.invalidRow", { sheet: error.sheet, row: error.row ?? "—" }) : "";
        setError(`${context} ${t("inventory.collectionTransfer.invalidWorkbook")}`.trim()); return;
      }
      setPage(0); setAcknowledged(false); attempt.current = crypto.randomUUID();
      requestAnimationFrame(() => title.current?.focus());
    } catch (error) { setError(report(error)); }
    finally { inFlight.current = false; setBusy(false); }
  }
  async function save() {
    if (!review || !acknowledged || !attempt.current || inFlight.current) return;
    inFlight.current = true; setBusy(true); setError("");
    let success = false;
    try {
      const response = await request({ action: "import_collection", operation_id: attempt.current, collection: review });
      if (response.kind !== "imported") throw new Error();
      toast({ description: t("inventory.transfer.imported", response) }); success = true;
    } catch (error) { setError(report(error)); }
    finally { await refresh(); inFlight.current = false; setBusy(false); }
    if (success) close();
  }
  const entries = review ? [
    ...review.consumables.map(row => ({ key: `stock:${row.key}`, name: row.stock.name, notes: row.stock.notes, kind: "stock" as const, sourceKey: row.key, bottles: [{ key: row.key, text: `${row.stock.quantity.value} ${t(`inventory.units.${row.stock.quantity.unit}`)} · ${t(`inventory.categories.${row.stock.category}`)}` }] })),
    ...review.meads.map(row => ({ key: `mead:${row.key}`, name: row.name, notes: row.notes, kind: "mead" as const, sourceKey: row.key, bottles: row.bottles.map(bottle => ({ key: bottle.key, text: `${bottle.quantity} × ${formatStoredBottleSize(bottle, i18n.language)}` })) })),
  ] : [];
  const locationPaths = new Map<string, string>();
  for (const row of review?.locations ?? []) {
    const names = [row.name]; let parent = row.parent_key;
    while (parent) { const ancestor = review!.locations.find(location => location.key === parent)!; names.unshift(ancestor.name); parent = ancestor.parent_key; }
    locationPaths.set(row.key, names.join(" → "));
  }
  const locationPath = (key: string) => locationPaths.get(key) ?? "";
  const hasData = Boolean(review && (entries.length || review.labels.length || review.locations.length));
  return <Accordion type="single" collapsible className="border-t">
    <AccordionItem value="collection-transfer">
      <AccordionTrigger className="text-base font-semibold">{t("inventory.collectionTransfer.title")}</AccordionTrigger>
      <AccordionContent>
        <div className="space-y-4">
          <p className="max-w-3xl text-sm text-muted-foreground">{t("inventory.collectionTransfer.help")}</p>
          <div className="flex flex-wrap gap-2">
            {canManage ? <Button ref={trigger} variant="outline" disabled={busy} onClick={() => setOpen(true)}>{t("inventory.collectionTransfer.import")}</Button> : null}
            <LoadingButton variant="outline" loading={busy && !open} disabled={busy || organization.overview.isPending || organization.overview.isError} onClick={() => void download(false)}>{t("inventory.collectionTransfer.export")}</LoadingButton>
            <Button variant="ghost" disabled={busy || organization.overview.isPending || organization.overview.isError} onClick={() => void download(true)}>{t("inventory.collectionTransfer.template")}</Button>
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>
    {open && canManage ? <Dialog open onOpenChange={value => { if (!value) close(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl" onOpenAutoFocus={event => { event.preventDefault(); title.current?.focus(); }} onEscapeKeyDown={event => { if (busy) event.preventDefault(); }} onInteractOutside={event => { if (busy) event.preventDefault(); }}>
        <DialogHeader><DialogTitle ref={title} tabIndex={-1}>{t(review ? "inventory.collectionTransfer.review" : "inventory.collectionTransfer.import")}</DialogTitle><DialogDescription>{t("inventory.collectionTransfer.scope")}</DialogDescription></DialogHeader>
        {review ? <div className="space-y-4">
          <p className="text-sm">{t("inventory.collectionTransfer.summary", { stock: review.consumables.length, meads: review.meads.length, labels: review.labels.length, locations: review.locations.length, allocations: review.allocations.length })}</p>
          <p className="text-sm text-muted-foreground">{t("inventory.collectionTransfer.reuse")}</p>
          {review.labels.length ? <p className="break-words text-sm">{t("inventory.organization.categories")}: {review.labels.map(row => row.name).join(", ")}</p> : null}
          {review.locations.length ? <Accordion type="single" collapsible><AccordionItem value="review-locations"><AccordionTrigger>{t("inventory.collectionTransfer.locations")}</AccordionTrigger><AccordionContent><ul className="space-y-1">{review.locations.map(row => <li className="break-words" key={row.key}>{locationPath(row.key)}</li>)}</ul></AccordionContent></AccordionItem></Accordion> : null}
          {entries.slice(page * 20, (page + 1) * 20).map(entry => <div key={entry.key} className="min-w-0 space-y-2 rounded-lg border p-3 text-sm">
            <p className="break-words font-medium">{entry.name}</p>
            {entry.notes ? <p className="whitespace-pre-wrap break-words text-muted-foreground">{entry.notes}</p> : null}
            <p className="break-words text-muted-foreground">{review.assignments.filter(row => row.kind === entry.kind && row.key === entry.sourceKey).map(row => review.labels.find(label => label.key === row.label_key)?.name).join(", ")}</p>
            <ul className="space-y-2">{entry.bottles.map(bottle => <li key={bottle.key}><p>{bottle.text}</p>{review.allocations.filter(row => row.stock_key === bottle.key).map((row, index) => <p key={index} className="break-words text-xs text-muted-foreground">{locationPath(row.location_key)}{row.position ? ` · ${row.position}` : ""} · {row.quantity}</p>)}</li>)}</ul>
          </div>)}
          {entries.length > 20 ? <div className="flex items-center justify-between gap-2"><Button variant="outline" disabled={!page || busy} onClick={() => setPage(page - 1)}>{t("inventory.transfer.previous")}</Button><span className="text-sm">{t("inventory.transfer.page", { page: page + 1, total: Math.ceil(entries.length / 20) })}</span><Button variant="outline" disabled={(page + 1) * 20 >= entries.length || busy} onClick={() => setPage(page + 1)}>{t("inventory.transfer.next")}</Button></div> : null}
          <div className="flex items-start gap-3"><Checkbox id={`${id}-ack`} checked={acknowledged} disabled={busy} onCheckedChange={value => setAcknowledged(value === true)} /><Label className="leading-relaxed" htmlFor={`${id}-ack`}>{t("inventory.collectionTransfer.acknowledge")}</Label></div>
        </div> : <div className="space-y-2"><Label htmlFor={`${id}-file`}>{t("inventory.transfer.file")}</Label><Input id={`${id}-file`} type="file" accept=".xlsx" disabled={busy} onChange={event => { setFile(event.target.files?.[0] ?? null); setError(""); }} /><p className="text-sm text-muted-foreground">{t("inventory.collectionTransfer.fileHelp")}</p></div>}
        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
        <DialogFooter className="gap-2"><Button variant="outline" disabled={busy} onClick={close}>{t("equipment.cancel")}</Button>{review ? <><Button variant="outline" disabled={busy} onClick={() => { setReview(null); setError(""); setAcknowledged(false); }}>{t("inventory.transfer.back")}</Button><LoadingButton loading={busy} disabled={!acknowledged || !hasData} onClick={() => void save()}>{t("inventory.collectionTransfer.confirm")}</LoadingButton></> : <LoadingButton loading={busy} disabled={!file} onClick={() => void inspect()}>{t("inventory.transfer.review")}</LoadingButton>}</DialogFooter>
      </DialogContent>
    </Dialog> : null}
  </Accordion>;
}

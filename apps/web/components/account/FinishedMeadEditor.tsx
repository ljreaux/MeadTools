"use client";
import { InventoryDialogContent as DialogContent } from "./InventoryDialogContent";
import { formatStoredBottleSize } from "@/lib/utils/bottleUnits";
import { type BottleDisplaySize } from "@meadtools/inventory-domain";
import { useId, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { convertQuantity, finishedMeadInputSchema, finishedMeadDetailsSchema } from "@meadtools/inventory-domain";
import { updateFinishedMeadRequestBodySchema } from "@meadtools/api-contract/inventory";
import type { FinishedMeadItem, InventoryStorageSource } from "@meadtools/api-contract/contracts";
import { InventoryUseSource } from "./InventoryOrganizationSummary";
import type { FinishedMeadCommand } from "@/hooks/reactQuery/useFinishedMeads";
import { isValidNumber, parseNumber } from "@/lib/utils/validateInput";
import { AmountUnitField } from "@/components/ui/amount-unit-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

const bottleDisplayUnits = ["mL", "L", "fl_oz", "gal"] as const;

export type FinishedMeadAction = "details" | "receipt" | "manual_use" | "correction";
type BottleDraft = { key: string; size: string; unit: BottleDisplaySize["unit"]; quantity: string };
const numeric = (value: string) => value.trim() && isValidNumber(value) ? parseNumber(value) : NaN;
const newBottle = (unit: BottleDisplaySize["unit"]): BottleDraft => ({ key: crypto.randomUUID(), size: unit === "fl_oz" ? "12" : unit === "gal" ? "1" : unit === "L" ? "0.75" : "750", unit, quantity: "" });

export function FinishedMeadEditor({ item, action, busy, error, onClose, onSave }: {
  item: FinishedMeadItem | null; action: FinishedMeadAction; busy: boolean; error: string;
  onClose: () => void; onSave: (command: FinishedMeadCommand) => Promise<void>;
}) {
  const { t, i18n } = useTranslation();
  const id = useId();
  const [name, setName] = useState(item?.name ?? "");
  const [notes, setNotes] = useState(action === "details" ? item?.notes ?? "" : "");
  const [rows, setRows] = useState<BottleDraft[]>(() => {
    const bottle = item?.bottles[0];
    const size = bottle?.display_size ?? (bottle ? { value: bottle.size_liters, unit: "L" as const } : null);
    return [{ ...newBottle(size?.unit ?? "fl_oz"), ...(size ? { size: String(size.value) } : {}) }];
  });
  const [size, setSize] = useState(String(item?.bottles[0]?.size_liters ?? 0.75));
  const [amount, setAmount] = useState(item && action === "correction" ? String(item.bottles[0]?.quantity ?? 0) : "");
  const [invalid, setInvalid] = useState(false);
  const [source, setSource] = useState<InventoryStorageSource | undefined>(undefined);
  function patchRow(key: string, patch: Partial<BottleDraft>) {
    setRows((current) => current.map((row) => row.key === key ? { ...row, ...patch } : row));
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    setInvalid(false);
    if (item && action === "details") {
      const details = finishedMeadDetailsSchema.safeParse({ name, notes: notes.trim() || null });
      if (!details.success) { setInvalid(true); return; }
      await onSave({ id: item.id, change: { action, expected_revision: item.revision, ...details.data } });
    } else if (!item) {
      try {
        const mead = finishedMeadInputSchema.parse({ name, notes: notes.trim() || null, bottles: rows.map((row) => ({
          size_liters: convertQuantity({ value: numeric(row.size), unit: row.unit }, "L").value,
          quantity: numeric(row.quantity),
          display_size: { value: numeric(row.size), unit: row.unit },
        })) });
        await onSave({ mead });
      } catch { setInvalid(true); }
    } else {
      let sizeLiters: number;
      try {
        sizeLiters = action === "receipt"
          ? convertQuantity({ value: numeric(rows[0].size), unit: rows[0].unit }, "L").value
          : Number(size);
      } catch { setInvalid(true); return; }
      const change = updateFinishedMeadRequestBodySchema.safeParse({
        action, expected_revision: item.revision, operation_id: crypto.randomUUID(),
        ...(action === "receipt" ? { display_size: { value: numeric(rows[0].size), unit: rows[0].unit } } : {}),
        size_liters: sizeLiters, quantity: numeric(amount), note: notes.trim() || null,
        ...(action === "manual_use" && source !== undefined ? { storage_source: source } : {}),
      });
      if (!change.success) { setInvalid(true); return; }
      if ("size_liters" in change.data) {
        const { action, expected_revision, size_liters, display_size, quantity, note, storage_source } = change.data;
        await onSave({ id: item.id, change: { action, expected_revision, size_liters, ...(display_size ? { display_size } : {}), quantity, note, ...(storage_source === undefined ? {} : { storage_source }) } });
      }
    }
  }
  const needsSizeDraft = !item || action === "receipt";
  return <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose(); }}>
    <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
      <DialogHeader>
        <DialogTitle>{t(item ? `inventory.meads.actions.${action}` : "inventory.meads.add")}</DialogTitle>
        <DialogDescription>{item?.name ?? t("inventory.meads.addDescription")}</DialogDescription>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-5">
        {!item || action === "details" ? <div className="space-y-2">
          <Label htmlFor={`${id}-name`}>{t("inventory.name")}</Label>
          <Input id={`${id}-name`} value={name} onChange={(event) => setName(event.target.value)} required maxLength={200} disabled={busy} />
          <p className="text-sm text-muted-foreground">{t("inventory.meads.nameHelp")}</p>
        </div> : null}
        {needsSizeDraft ? <div className="space-y-4">
          {rows.map((row, index) => <fieldset key={row.key} className="space-y-3 rounded-lg border p-3" disabled={busy}>
            <legend className="px-1 text-sm font-medium">{t("inventory.meads.bottleSize")}</legend>
            <Label htmlFor={`${id}-size-${row.key}`}>{t("inventory.meads.capacity")}</Label>
            <AmountUnitField id={`${id}-size-${row.key}`} amount={row.size} unit={row.unit} onAmountChange={(value) => patchRow(row.key, { size: value })} disabled={busy}
              unitControl={<Select value={row.unit} onValueChange={(value: BottleDraft["unit"]) => patchRow(row.key, { unit: value })} disabled={busy}>
                <SelectTrigger className="w-auto min-w-16 border-none shadow-none" aria-label={t("inventory.meads.capacityUnit")}><SelectValue /></SelectTrigger>
                <SelectContent>{bottleDisplayUnits.map((unit) => <SelectItem key={unit} value={unit}>{t(`inventory.units.${unit}`)}</SelectItem>)}</SelectContent>
              </Select>} />
            {!item ? <><Label htmlFor={`${id}-count-${row.key}`}>{t("inventory.meads.onHand")}</Label>
              <AmountUnitField id={`${id}-count-${row.key}`} amount={row.quantity} unit={t("inventory.meads.bottlesUnit")} onAmountChange={(quantity) => patchRow(row.key, { quantity })} disabled={busy} />
              {rows.length > 1 ? <Button type="button" variant="ghost" size="sm" onClick={() => setRows((current) => current.filter((entry) => entry.key !== row.key))} aria-label={t("inventory.meads.removeSizeNamed", { index: index + 1 })}>{t("inventory.meads.removeSize")}</Button> : null}
            </> : null}
          </fieldset>)}
          {!item ? <Button type="button" variant="outline" disabled={busy || rows.length >= 50} onClick={() => setRows((current) => [...current, newBottle(rows[rows.length - 1]?.unit ?? "fl_oz")])}>{t("inventory.meads.addSize")}</Button>
            : <p className="text-sm text-muted-foreground">{t("inventory.meads.receiptHelp")}</p>}
        </div> : null}
        {item && action !== "details" ? <>
          {action !== "receipt" ? <div className="space-y-2"><Label htmlFor={`${id}-size`}>{t("inventory.meads.bottleSize")}</Label>
            <Select value={size} disabled={busy} onValueChange={(value) => { setSize(value); setSource(undefined); if (action === "correction") setAmount(String(item.bottles.find((bottle) => String(bottle.size_liters) === value)?.quantity ?? 0)); }}>
              <SelectTrigger id={`${id}-size`}><SelectValue /></SelectTrigger>
              <SelectContent>{item.bottles.map((bottle) => <SelectItem key={bottle.id} value={String(bottle.size_liters)}>{formatStoredBottleSize(bottle, i18n.language)} · {t("inventory.meads.remaining", { count: bottle.quantity })}</SelectItem>)}</SelectContent>
            </Select></div> : null}
          <div className="space-y-2"><Label htmlFor={`${id}-quantity`}>{t(action === "correction" ? "inventory.meads.onHand" : "inventory.quantity")}</Label>
            <AmountUnitField id={`${id}-quantity`} amount={amount} unit={t("inventory.meads.bottlesUnit")} onAmountChange={setAmount} disabled={busy} />
            <p className="text-sm text-muted-foreground">{t(action === "correction" ? "inventory.correctionHelp" : action === "manual_use" ? "inventory.meads.useHelp" : "inventory.meads.countHelp")}</p>
          </div>
        </> : null}
        {item && action === "manual_use" ? <InventoryUseSource stockId={item.bottles.find((row) => String(row.size_liters) === size)?.id} value={source} onChange={setSource} disabled={busy} /> : null}
        <div className="space-y-2"><Label htmlFor={`${id}-notes`}>{t("inventory.notes")}</Label>
          <Textarea id={`${id}-notes`} value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={5000} disabled={busy} />
        </div>
        {invalid || error ? <p role="alert" className="text-sm text-destructive">{invalid ? t(!item ? "inventory.meads.invalidCreate" : action === "details" ? "inventory.meads.invalidName" : "inventory.meads.invalid") : error}</p> : null}
        <DialogFooter><Button type="button" variant="outline" disabled={busy} onClick={onClose}>{t("equipment.cancel")}</Button>
          <LoadingButton type="submit" loading={busy} loadingText={t("equipment.saving")}>{t("inventory.meads.save")}</LoadingButton>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}

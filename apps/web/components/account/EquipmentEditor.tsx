"use client";

import { useId, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { capacityUnitSchema, equipmentInputSchema } from "@meadtools/inventory-domain";
import type { EquipmentItem, CreateEquipmentRequestBody } from "@meadtools/api-contract/contracts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const equipmentSelectClass = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50";

export function EquipmentEditor({ item, busy, error, onClose, onSave }: {
  item: EquipmentItem | null; busy: boolean; error: string;
  onClose: () => void;
  onSave: (value: CreateEquipmentRequestBody["equipment"]) => Promise<void>;
}) {
  const { t } = useTranslation();
  const id = useId();
  const [name, setName] = useState(item?.name ?? "");
  const [type, setType] = useState<"vessel" | "other">(item?.type ?? "vessel");
  const [capacity, setCapacity] = useState(item?.capacity?.value.toString() ?? "");
  const [unit, setUnit] = useState(item?.capacity?.unit ?? "L");
  const [notes, setNotes] = useState(item?.notes ?? "");
  const [invalid, setInvalid] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const result = equipmentInputSchema.safeParse({ name, type,
      capacity: type === "vessel" && capacity.trim() ? { value: Number(capacity), unit } : null,
      notes: notes.trim() || null });
    setInvalid(!result.success);
    if (result.success) await onSave(result.data);
  }
  return <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose(); }}>
    <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>{t(item ? "equipment.editTitle" : "equipment.addTitle")}</DialogTitle>
        <DialogDescription>{t("equipment.editorDescription")}</DialogDescription>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2"><Label htmlFor={`${id}-name`}>{t("equipment.name")}</Label>
          <Input id={`${id}-name`} value={name} onChange={(e) => setName(e.target.value)} required maxLength={200} disabled={busy} autoFocus /></div>
        <div className="space-y-2"><Label htmlFor={`${id}-type`}>{t("equipment.type")}</Label>
          <select id={`${id}-type`} value={type} onChange={(e) => setType(e.target.value as "vessel" | "other")} className={equipmentSelectClass} disabled={busy || Boolean(item?.brew)}>
            <option value="vessel">{t("equipment.vessel")}</option><option value="other">{t("equipment.tool")}</option>
          </select></div>
        {type === "vessel" ? <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2"><Label htmlFor={`${id}-capacity`}>{t("equipment.capacityOptional")}</Label>
            <Input id={`${id}-capacity`} type="number" min="0.000001" max="1000000000" step="0.000001" value={capacity} onChange={(e) => setCapacity(e.target.value)} disabled={busy} /></div>
          <div className="space-y-2"><Label htmlFor={`${id}-unit`}>{t("equipment.unit")}</Label>
            <select id={`${id}-unit`} value={unit} onChange={(e) => setUnit(e.target.value as typeof unit)} className={equipmentSelectClass} disabled={busy}>
              {capacityUnitSchema.options.map((value) => <option key={value} value={value}>{t(`equipment.units.${value}`)}</option>)}
            </select></div>
        </div> : null}
        <div className="space-y-2"><Label htmlFor={`${id}-notes`}>{t("equipment.notes")}</Label>
          <Textarea id={`${id}-notes`} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={5000} disabled={busy} /></div>
        {invalid || error ? <p role="alert" className="text-sm text-destructive">{invalid ? t("equipment.invalid") : error}</p> : null}
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={busy} onClick={onClose}>{t("equipment.cancel")}</Button>
          <Button type="submit" disabled={busy}>{t(busy ? "equipment.saving" : "equipment.save")}</Button></div>
      </form>
    </DialogContent>
  </Dialog>;
}

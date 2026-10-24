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

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LoadingButton } from "@/components/ui/LoadingButton";

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
          <Select value={type} onValueChange={(value) => setType(value as "vessel" | "other")} disabled={busy || Boolean(item?.brew)}>
            <SelectTrigger id={`${id}-type`}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="vessel">{t("equipment.vessel")}</SelectItem>
              <SelectItem value="other">{t("equipment.tool")}</SelectItem>
            </SelectContent>
          </Select></div>
        {type === "vessel" ? <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2"><Label htmlFor={`${id}-capacity`}>{t("equipment.capacityOptional")}</Label>
            <Input id={`${id}-capacity`} type="number" min="0.000001" max="1000000000" step="0.000001" value={capacity} onChange={(e) => setCapacity(e.target.value)} disabled={busy} /></div>
          <div className="space-y-2"><Label htmlFor={`${id}-unit`}>{t("equipment.unit")}</Label>
            <Select value={unit} onValueChange={(value) => setUnit(value as typeof unit)} disabled={busy}>
              <SelectTrigger id={`${id}-unit`}><SelectValue /></SelectTrigger>
              <SelectContent>
                {capacityUnitSchema.options.map((value) => <SelectItem key={value} value={value}>{t(`equipment.units.${value}`)}</SelectItem>)}
              </SelectContent>
            </Select></div>
        </div> : null}
        <div className="space-y-2"><Label htmlFor={`${id}-notes`}>{t("equipment.notes")}</Label>
          <Textarea id={`${id}-notes`} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={5000} disabled={busy} /></div>
        {invalid || error ? <p role="alert" className="text-sm text-destructive">{invalid ? t("equipment.invalid") : error}</p> : null}
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={busy} onClick={onClose}>{t("equipment.cancel")}</Button>
          <LoadingButton type="submit" loading={busy} loadingText={t("equipment.saving")}>{t("equipment.save")}</LoadingButton></div>
      </form>
    </DialogContent>
  </Dialog>;
}

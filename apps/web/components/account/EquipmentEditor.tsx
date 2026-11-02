"use client";

import { useId, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import {
  capacityUnitSchema,
  equipmentInputSchema,
} from "@meadtools/inventory-domain";
import type {
  EquipmentItem,
  CreateEquipmentRequestBody,
} from "@meadtools/api-contract/contracts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AmountUnitField } from "@/components/ui/amount-unit-field";
import { LoadingButton } from "@/components/ui/LoadingButton";

export function EquipmentEditor({
  item,
  total = 1,
  busy,
  error,
  onClose,
  onSave,
}: {
  item: EquipmentItem | null;
  total?: number;
  busy: boolean;
  error: string;
  onClose: () => void;
  onSave: (
    value: CreateEquipmentRequestBody["equipment"],
    quantity: number,
  ) => Promise<void>;
}) {
  const { t } = useTranslation();
  const id = useId();
  const [quantity, setQuantity] = useState(String(total));
  const [name, setName] = useState(item?.name ?? "");
  const [type, setType] = useState<"vessel" | "other">(item?.type ?? "vessel");
  const [capacity, setCapacity] = useState(
    item?.capacity?.value.toString() ?? "",
  );
  const [unit, setUnit] = useState(item?.capacity?.unit ?? "L");
  const [notes, setNotes] = useState(item?.notes ?? "");
  const [invalid, setInvalid] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const result = equipmentInputSchema.safeParse({
      name,
      type,
      capacity:
        type === "vessel" && capacity.trim()
          ? { value: Number(capacity), unit }
          : null,
      notes: notes.trim() || null,
    });
    const count = Number(quantity);
    const valid = Number.isInteger(count) && count >= 1 && count <= 100;
    setInvalid(!result.success || !valid);
    if (result.success && valid) await onSave(result.data, count);
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {t(item ? "equipment.editTitle" : "equipment.addTitle")}
          </DialogTitle>
          <DialogDescription>
            {t("equipment.editorDescription")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`${id}-name`}>{t("equipment.name")}</Label>
            <Input
              id={`${id}-name`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={200}
              disabled={busy}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${id}-quantity`}>
              {t("equipment.quantityOwned")}
            </Label>
            <Input
              id={`${id}-quantity`}
              type="number"
              min={1}
              max={100}
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              disabled={busy}
            />
            <p className="text-xs text-muted-foreground">
              {t("equipment.quantityHelp")}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${id}-type`}>{t("equipment.type")}</Label>
            <Select
              value={type}
              onValueChange={(value) => setType(value as "vessel" | "other")}
              disabled={busy || Boolean(item?.brew)}
            >
              <SelectTrigger id={`${id}-type`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="vessel">{t("equipment.vessel")}</SelectItem>
                <SelectItem value="other">{t("equipment.tool")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {type === "vessel" ? (
            <div className="space-y-2">
              <Label htmlFor={`${id}-capacity`}>
                {t("equipment.capacityOptional")}
              </Label>
              <AmountUnitField
                id={`${id}-capacity`}
                amount={capacity}
                unit={unit}
                onAmountChange={setCapacity}
                disabled={busy}
                unitControl={
                  <Select
                    value={unit}
                    onValueChange={(value) => setUnit(value as typeof unit)}
                    disabled={busy}
                  >
                    <SelectTrigger
                      className="w-auto min-w-16 border-none shadow-none focus:ring-0"
                      aria-label={t("equipment.unit")}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {capacityUnitSchema.options.map((value) => (
                        <SelectItem key={value} value={value}>
                          {t(`equipment.units.${value}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                }
              />
            </div>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor={`${id}-notes`}>{t("equipment.notes")}</Label>
            <Textarea
              id={`${id}-notes`}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={5000}
              disabled={busy}
            />
          </div>
          {invalid || error ? (
            <p role="alert" className="text-sm text-destructive">
              {invalid ? t("equipment.invalid") : error}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={onClose}
            >
              {t("equipment.cancel")}
            </Button>
            <LoadingButton
              type="submit"
              loading={busy}
              loadingText={t("equipment.saving")}
            >
              {t("equipment.save")}
            </LoadingButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

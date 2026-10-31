"use client";

import { useId, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import {
  quantitySchema,
  quantityUnitSchema,
  capacityUnitSchema,
  stockInputSchema,
  validateStockQuantity,
} from "@meadtools/inventory-domain";
import type { InventoryStockItem } from "@meadtools/api-contract/contracts";
import type { InventoryCommand } from "@/hooks/reactQuery/useInventory";
import { InventoryCatalogField } from "./InventoryCatalogField";
import { AmountUnitField } from "@/components/ui/amount-unit-field";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectGroup,
  SelectLabel,
  SelectSeparator,
  SelectItem,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

export const inventoryCategories = [
  "honey",
  "fruit",
  "yeast",
  "additive",
  "packaging",
] as const;
const inventoryUnitGroups = [
  {
    label: "weight",
    units: quantityUnitSchema.options.filter(
      (unit) => unit !== "units" && !capacityUnitSchema.safeParse(unit).success,
    ),
  },
  { label: "volume", units: capacityUnitSchema.options },
  { label: "count", units: ["units"] as const },
];
export type InventoryAction =
  "details" | "receipt" | "manual_use" | "correction";
export function InventoryEditor({
  item,
  action,
  busy,
  error,
  onClose,
  onSave,
}: {
  item: InventoryStockItem | null;
  action: InventoryAction;
  busy: boolean;
  error: string;
  onClose: () => void;
  onSave: (command: InventoryCommand) => Promise<void>;
}) {
  const { t } = useTranslation();
  const id = useId();
  const [name, setName] = useState(item?.name ?? "");
  const [category, setCategory] = useState<
    (typeof inventoryCategories)[number]
  >(item?.category ?? "honey");
  const [amount, setAmount] = useState(
    item && action === "correction" ? String(item.quantity.value) : "",
  );
  const [unit, setUnit] = useState(item?.quantity.unit ?? "kg");
  const [notes, setNotes] = useState(
    action === "details" ? (item?.notes ?? "") : "",
  );
  const [catalogReference, setReference] = useState(
    item?.catalogReference ?? null,
  );
  const [invalid, setInvalid] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (item && action === "details") {
      await onSave({
        id: item.id,
        change: { action, name, catalogReference, notes: notes.trim() || null },
      });
      return;
    }
    const quantity = quantitySchema.safeParse({
      value: amount.trim() ? Number(amount) : NaN,
      unit,
    });
    if (
      !quantity.success ||
      (item && action !== "correction" && quantity.data.value === 0)
    ) {
      setInvalid(true);
      return;
    }
    if (item && action !== "details") {
      try {
        validateStockQuantity(item.category, quantity.data);
      } catch {
        setInvalid(true);
        return;
      }
      setInvalid(false);
      await onSave({
        id: item.id,
        change: {
          action,
          quantity: quantity.data,
          expected_balance: item.quantity,
          note: notes.trim() || null,
        },
      });
    } else {
      const stock = stockInputSchema.safeParse({
        name,
        category,
        catalogReference,
        quantity: quantity.data,
        notes: notes.trim() || null,
      });
      setInvalid(!stock.success);
      if (stock.success) await onSave({ stock: stock.data });
    }
  }
  const title = item ? t(`inventory.actions.${action}`) : t("inventory.add");
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {item ? item.name : t("inventory.addDescription")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {!item || action === "details" ? (
            <>
              <div className="space-y-2">
                <Label htmlFor={`${id}-name`}>{t("inventory.name")}</Label>
                <Input
                  id={`${id}-name`}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={200}
                  required
                  disabled={busy}
                />
              </div>
              {!item ? (
                <div className="space-y-2">
                  <Label htmlFor={`${id}-category`}>
                    {t("inventory.category")}
                  </Label>
                  <Select
                    value={category}
                    onValueChange={(value) => {
                      setCategory(value as typeof category);
                      setReference(null);
                      if (value === "packaging") setUnit("units");
                      else if (category === "packaging") setUnit("kg");
                    }}
                    disabled={busy}
                  >
                    <SelectTrigger id={`${id}-category`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {inventoryCategories.map((value) => (
                        <SelectItem key={value} value={value}>
                          {t(`inventory.categories.${value}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
              <InventoryCatalogField
                category={category}
                value={catalogReference}
                onChange={setReference}
                disabled={busy}
              />
            </>
          ) : null}
          {action !== "details" ? (
            <div className="space-y-2">
              <Label htmlFor={`${id}-amount`}>
                {t(
                  item && action === "correction"
                    ? "inventory.actualQuantity"
                    : "inventory.quantity",
                )}
              </Label>
              <AmountUnitField
                id={`${id}-amount`}
                amount={amount}
                unit={t(`inventory.units.${unit}`)}
                onAmountChange={setAmount}
                disabled={busy}
                unitControl={
                  !item && category !== "packaging" ? (
                    <Select
                      value={unit}
                      onValueChange={(value) => setUnit(value as typeof unit)}
                      disabled={busy}
                    >
                      <SelectTrigger
                        aria-label={t("inventory.unit")}
                        className="w-auto min-w-16 border-none shadow-none focus:ring-0"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {inventoryUnitGroups.map((group, index) => (
                          <SelectGroup key={group.label}>
                            {index ? <SelectSeparator /> : null}
                            <SelectLabel>
                              {t(`inventory.unitGroups.${group.label}`)}
                            </SelectLabel>
                            {group.units.map((value) => (
                              <SelectItem key={value} value={value}>
                                {t(`inventory.units.${value}`)}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : undefined
                }
              />
              <p className="text-sm text-muted-foreground">
                {t(
                  (item?.category ?? category) === "packaging"
                    ? "inventory.packagingHelp"
                    : item
                      ? action === "correction"
                        ? "inventory.correctionHelp"
                        : "inventory.changeHelp"
                      : "inventory.unitHelp",
                )}
              </p>
            </div>
          ) : null}
          {(item?.category ?? category) === "yeast" ? (
            <p className="text-sm text-muted-foreground">
              {t(item ? "inventory.yeastSavedUnitHelp" : "inventory.yeastPacketHelp")}
            </p>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor={`${id}-note`}>{t("inventory.notes")}</Label>
            <Textarea
              id={`${id}-note`}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              maxLength={5000}
              disabled={busy}
            />
          </div>
          {invalid || error ? (
            <p role="alert" className="text-sm text-destructive">
              {invalid ? t("inventory.invalid") : error}
            </p>
          ) : null}
          <DialogFooter>
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
              {t("inventory.save")}
            </LoadingButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

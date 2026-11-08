"use client";
import { InventoryDialogContent as DialogContent } from "./InventoryDialogContent";

import { useId, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import {
  quantitySchema,
  quantityUnitSchema,
  capacityUnitSchema,
  stockInputSchema,
  validateStockQuantity,
} from "@meadtools/inventory-domain";
import type { InventoryStockItem, InventoryStorageSource } from "@meadtools/api-contract/contracts";
import { InventoryUseSource } from "./InventoryOrganizationSummary";
import type { InventoryCommand } from "@/hooks/reactQuery/useInventory";
import { InventoryCatalogField } from "./InventoryCatalogField";
import {
  compatibleUnits,
  emptyPriceDraft,
  InventoryPriceFields,
  parsePriceDraft,
} from "./InventoryPriceFields";
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
  "details" | "receipt" | "manual_use" | "correction" | "set_unit_cost";
export function InventoryEditor({
  item,
  action,
  busy,
  error,
  currency,
  onClose,
  onSave,
}: {
  item: InventoryStockItem | null;
  action: InventoryAction;
  busy: boolean;
  error: string;
  /** Account inventory currency; null until chosen with the first price. */
  currency: string | null;
  onClose: () => void;
  onSave: (command: InventoryCommand, currency: string | null) => Promise<void>;
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
  const [source, setSource] = useState<InventoryStorageSource | undefined>(undefined);
  const [priceDraft, setPriceDraft] = useState(() =>
    emptyPriceDraft(item?.quantity.unit ?? "kg", currency, action === "set_unit_cost" ? "1" : ""));
  const stockUnit = item?.quantity.unit ?? unit;
  // A new item's unit can change after a price unit was chosen.
  const price = compatibleUnits(stockUnit).includes(priceDraft.perUnit)
    ? priceDraft : { ...priceDraft, perUnit: stockUnit };
  const pricing = !item || action === "receipt" || action === "set_unit_cost";
  const pricedStock = item?.cost.unit_cost != null;
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (item && action === "details") {
      await onSave({
        id: item.id,
        change: { action, name, catalogReference, notes: notes.trim() || null },
      }, null);
      return;
    }
    if (item && action === "set_unit_cost") {
      const parsed = parsePriceDraft(price, null);
      if (!parsed || parsed === "invalid") { setInvalid(true); return; }
      setInvalid(false);
      await onSave({ id: item.id, change: { action, price: parsed, note: notes.trim() || null } },
        currency ? null : parsed.currency);
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
    const parsedPrice = pricing ? parsePriceDraft(price, quantity.data) : null;
    if (parsedPrice === "invalid") {
      setInvalid(true);
      return;
    }
    const newCurrency = parsedPrice && !currency ? parsedPrice.currency : null;
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
          // set_unit_cost and details returned above.
          action: action as "receipt" | "manual_use" | "correction",
          quantity: quantity.data,
          expected_balance: item.quantity,
          ...(action === "manual_use" && source !== undefined ? { storage_source: source } : {}),
          ...(action === "receipt" && parsedPrice ? { price: parsedPrice } : {}),
          note: notes.trim() || null,
        },
      }, newCurrency);
    } else {
      const stock = stockInputSchema.safeParse({
        name,
        category,
        catalogReference,
        quantity: quantity.data,
        notes: notes.trim() || null,
      });
      setInvalid(!stock.success);
      if (stock.success) await onSave({ stock: stock.data, price: parsedPrice }, newCurrency);
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
          {action !== "details" && action !== "set_unit_cost" ? (
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
          {pricing ? (
            <InventoryPriceFields
              id={`${id}-cost`}
              draft={price}
              onChange={setPriceDraft}
              stockUnit={stockUnit}
              accountCurrency={currency}
              required={action === "set_unit_cost"}
              perPlaceholder={t(action === "set_unit_cost" ? "inventoryCosts.valuationHelp" : "inventoryCosts.perDefaultHelp")}
              disabled={busy}
            />
          ) : null}
          {item && action === "receipt" && pricedStock && !price.amount.trim() ? (
            <p className="text-sm text-amber-700 dark:text-amber-400">{t("inventoryCosts.unpricedReceiptWarning")}</p>
          ) : null}
          {item && action === "manual_use" ? <InventoryUseSource stockId={item.id} value={source} onChange={setSource} disabled={busy} /> : null}
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

"use client";
import { useId, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import {
  quantitySchema,
  validateStockQuantity,
} from "@meadtools/inventory-domain";
import type { InventoryStockHistoryResponse } from "@meadtools/api-contract/contracts";
import {
  useInventoryHistory,
  type InventoryCommand,
} from "@/hooks/reactQuery/useInventory";
import { AmountUnitField } from "@/components/ui/amount-unit-field";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

export function InventoryReconcileDialog({
  stockId,
  busy,
  error,
  onClose,
  onSave,
}: {
  stockId: string;
  busy: boolean;
  error: string;
  onClose: () => void;
  onSave: (command: InventoryCommand) => Promise<void>;
}) {
  const { t } = useTranslation();
  const query = useInventoryHistory(stockId);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("inventory.reconcile.title")}</DialogTitle>
          <DialogDescription>
            {t("inventory.reconcile.description")}
          </DialogDescription>
        </DialogHeader>
        {query.isPending || (!query.isFetchedAfterMount && !query.isError) ? (
          <p role="status">{t("inventory.loading")}</p>
        ) : query.isError ? (
          <div role="alert" className="space-y-2">
            <p>{t("inventory.loadError")}</p>
            <Button variant="outline" onClick={() => void query.refetch()}>
              {t("equipment.retry")}
            </Button>
          </div>
        ) : query.data?.reconciliation ? (
          <ReconcileForm
            key={stockId}
            data={query.data}
            busy={busy}
            error={error}
            onClose={onClose}
            onSave={onSave}
          />
        ) : (
          <p>{t("inventory.reconcile.alreadyReviewed")}</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
function ReconcileForm({
  data,
  busy,
  error,
  onClose,
  onSave,
}: {
  data: InventoryStockHistoryResponse;
  busy: boolean;
  error: string;
  onClose: () => void;
  onSave: (command: InventoryCommand) => Promise<void>;
}) {
  const { t, i18n } = useTranslation();
  const id = useId();
  // Keep the reviewed snapshot fixed while the form is open, even if query
  // invalidation refreshes history in the background.
  const [review] = useState(() => data);
  const [amount, setAmount] = useState(String(review.stock.quantity.value));
  const [note, setNote] = useState("");
  const [invalid, setInvalid] = useState(false);
  const format = (quantity: { value: number; unit: string }) =>
    `${new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 6 }).format(quantity.value)} ${t(`inventory.units.${quantity.unit}`)}`;
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const quantity = quantitySchema.safeParse({
      value: amount.trim() ? Number(amount) : NaN,
      unit: review.stock.quantity.unit,
    });
    try {
      if (!quantity.success) throw new Error();
      validateStockQuantity(review.stock.category, quantity.data);
    } catch {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    if (quantity.success)
      await onSave({
        id: review.stock.id,
        change: {
          action: "reconcile",
          revision: review.reconciliation!.revision,
          quantity: quantity.data,
          note: note.trim() || t("inventory.reconcile.historyNote"),
        },
      });
  }
  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="font-medium">{review.stock.name}</p>
      <div className="space-y-2">
        <Label htmlFor={`${id}-count`}>{t("inventory.actualQuantity")}</Label>
        <AmountUnitField
          id={`${id}-count`}
          amount={amount}
          unit={t(`inventory.units.${review.stock.quantity.unit}`)}
          onAmountChange={setAmount}
          disabled={busy}
        />
        <p className="text-sm text-muted-foreground">
          {t("inventory.reconcile.countHelp")}
        </p>
      </div>
      <div className="space-y-2">
        <h3 className="text-sm font-medium">
          {t("inventory.reconcile.linksTitle")}
        </h3>
        {review.reconciliation!.uses.length ? (
          <ul className="space-y-2">
            {review.reconciliation!.uses.map((use) => (
              <li key={use.id} className="rounded-md border p-3 text-sm">
                <p className="font-medium">
                  {use.name || t("inventory.reconcile.removedEntry")}
                </p>
                <p className="text-muted-foreground">
                  {use.current
                    ? t("inventory.reconcile.baseline", {
                        previous: format(use.previous),
                        current: format(use.current),
                      })
                    : t("inventory.reconcile.unlink", {
                        previous: format(use.previous),
                      })}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            {t("inventory.reconcile.noLinks")}
          </p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${id}-note`}>{t("inventory.notes")}</Label>
        <Textarea
          id={`${id}-note`}
          value={note}
          onChange={(event) => setNote(event.target.value)}
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
          onClick={onClose}
          disabled={busy}
        >
          {t("equipment.cancel")}
        </Button>
        <LoadingButton
          type="submit"
          loading={busy}
          loadingText={t("equipment.saving")}
        >
          {t("inventory.reconcile.confirm")}
        </LoadingButton>
      </DialogFooter>
    </form>
  );
}

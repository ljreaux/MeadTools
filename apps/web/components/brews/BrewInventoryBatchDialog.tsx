"use client";
import { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { CreateBrewEntryInput } from "@/hooks/reactQuery/useAccountBrews";
import type { BrewInventorySelection } from "@meadtools/api-contract/contracts";
import { tryInventoryEntryLines } from "@meadtools/inventory-domain";
import { useBrewStockChoice } from "./BrewStockField";
import { useBrewInventory } from "./BrewInventoryProvider";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { reportBrewInventoryError } from "@/lib/brews/inventoryUiError";
export type InventoryBatch = {
  entries: CreateBrewEntryInput[];
  operationId: string;
  save: (entries: CreateBrewEntryInput[], operationId: string) => Promise<void>;
  resolve: () => void;
  reject: (error: Error) => void;
};
export function BrewInventoryBatchDialog({
  batch,
  onClose,
}: {
  batch: InventoryBatch;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const inventory = useBrewInventory();
  const [busy, setBusy] = useState(false);
  const lines = batch.entries.flatMap((entry, index) =>
    tryInventoryEntryLines(
      entry.type,
      "data" in entry ? entry.data : undefined,
    ).map((line) => ({ ...line, key: `${index}/${line.key}` })),
  );
  const stock = useBrewStockChoice(null, undefined, "ADDITION", lines);
  async function save() {
    setBusy(true);
    try {
      const selection = stock.selection();
      const entries = batch.entries.map((entry, index) => ({
        ...entry,
        inventory:
          selection?.mode === "items"
            ? ({
                mode: "items",
                operation_id: batch.operationId,
                expected: [],
                items: selection.items
                  .filter((item) => item.line_key.startsWith(`${index}/`))
                  .map((item) => ({
                    ...item,
                    line_key: item.line_key.slice(String(index).length + 1),
                  })),
              } as BrewInventorySelection)
            : undefined,
      }));
      await batch.save(entries, batch.operationId);
      batch.resolve();
      onClose();
    } catch (error) {
      reportBrewInventoryError(error, t);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent
        className="max-h-[85vh] overflow-y-auto"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          titleRef.current?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle ref={titleRef} tabIndex={-1}>
            {t("brewInventory.batchTitle")}
          </DialogTitle>
          <DialogDescription>
            {t("brewInventory.batchDescription")}
          </DialogDescription>
        </DialogHeader>
        {inventory?.canManage ? (
          stock.field
        ) : (
          <p>{t("brewInventory.notUpdated")}</p>
        )}
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={onClose}>
            {t("equipment.cancel")}
          </Button>
          <LoadingButton
            onClick={() => void save()}
            disabled={!stock.valid}
            loading={busy}
            loadingText={t("equipment.saving")}
          >
            {t("brewInventory.batchSave")}
          </LoadingButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

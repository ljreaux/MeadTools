"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { useAuthToken } from "@/hooks/auth/useAuthToken";
import { useInventoryOrganization } from "./InventoryOrganizationProvider";
import type { InventoryOrganizationResponse } from "@meadtools/api-contract/contracts";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/Checkbox";
import { LoadingButton } from "@/components/ui/LoadingButton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
type Change = InventoryOrganizationResponse["bottling_changes"][number];
export function BottlingSourceChanges() {
  const { t } = useTranslation();
  const token = useAuthToken();
  const { overview } = useInventoryOrganization();
  const [selected, setSelected] = useState<Change | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const operation = useRef("");
  const changes = overview.data?.bottling_changes ?? [];
  async function acknowledge() {
    if (!selected || !confirmed) return;
    setBusy(true);
    try {
      const response = await fetch(
        `/api/account/inventory/bottlings/${selected.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            operation_id: operation.current,
            expected_revision: selected.revision,
            confirmed_on_hand: true,
          }),
        },
      );
      if (!response.ok)
        throw new Error((await response.json()).code ?? "FAILED");
      await overview.refetch();
      setSelected(null);
    } catch (error) {
      setError(
        t(
          `bottlingInventory.errors.${error instanceof Error ? error.message : "FAILED"}`,
          t("inventory.saveError"),
        ),
      );
    } finally {
      setBusy(false);
    }
  }
  if (!changes.length) return null;
  return (
    <div className="space-y-3 rounded-lg border p-4">
      <h3 className="font-medium">{t("bottlingInventory.changedSources")}</h3>
      <p className="text-sm text-muted-foreground">
        {t("bottlingInventory.changedSourcesHelp")}
      </p>
      <ul className="space-y-2">
        {changes.map((change) => (
          <li
            key={change.id}
            className="flex flex-wrap items-center justify-between gap-2 text-sm"
          >
            <span>{change.source_name}</span>
            {overview.data?.can_manage ? (
              change.source_missing ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    operation.current = crypto.randomUUID();
                    setConfirmed(false);
                    setError("");
                    setSelected(change);
                  }}
                >
                  {t("bottlingInventory.reviewCounts")}
                </Button>
              ) : (
                <Button size="sm" variant="outline" asChild>
                  <Link href={`/account/brews/${change.brew_id}`}>
                    {t("bottlingInventory.openBrew")}
                  </Link>
                </Button>
              )
            ) : null}
          </li>
        ))}
      </ul>
      {selected ? (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open && !busy) setSelected(null);
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("bottlingInventory.reviewCounts")}</DialogTitle>
              <DialogDescription>
                {t("bottlingInventory.removedSourceHelp")}
              </DialogDescription>
            </DialogHeader>
            <p className="text-sm">{selected.source_name}</p>
            <label className="flex items-start gap-2 text-sm">
              <Checkbox
                checked={confirmed}
                disabled={busy}
                onCheckedChange={(value) => setConfirmed(value === true)}
              />
              {t("bottlingInventory.confirmReconcile")}
            </label>
            {error ? (
              <p role="alert" className="text-destructive">
                {error}
              </p>
            ) : null}
            <DialogFooter>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => setSelected(null)}
              >
                {t("equipment.cancel")}
              </Button>
              <LoadingButton
                loading={busy}
                loadingText={t("equipment.saving")}
                disabled={!confirmed}
                onClick={() => void acknowledge()}
              >
                {t("bottlingInventory.acknowledge")}
              </LoadingButton>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}

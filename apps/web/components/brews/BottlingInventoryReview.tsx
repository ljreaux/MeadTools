"use client";
import { useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import {
  bottlingSelectionSchema,
  productionBottleRows,
  validateBottlingOutputs,
  type BottlingSelection,
} from "@meadtools/inventory-domain";
import { inventoryOrganizationResponseSchema } from "@meadtools/api-contract/inventory";
import type {
  BrewBottlingContext,
  BrewInventorySelection,
} from "@meadtools/api-contract/contracts";
import { useFinishedMeads } from "@/hooks/reactQuery/useFinishedMeads";
import { useAuth } from "@/hooks/auth/useAuth";
import { useAuthToken } from "@/hooks/auth/useAuthToken";
import SearchableInput from "@/components/ui/SearchableInput";
import { AmountUnitField } from "@/components/ui/amount-unit-field";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/Checkbox";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectValue,
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

type Draft = {
  id: string;
  row_id: string;
  quantity: string;
  mead_id: string;
  location_id: string;
  position: string;
};
export function BottlingInventoryReview({
  data,
  source,
  kind,
  name,
  packaging,
  onSave,
  onCancel,
}: {
  data: unknown;
  source?: BrewBottlingContext;
  kind: "create" | "edit" | "remove";
  name: string;
  packaging?: BrewInventorySelection;
  onSave: (selection: BottlingSelection) => Promise<void>;
  onCancel: () => void;
}) {
  const { t, i18n } = useTranslation();
  const id = useId();
  const { user } = useAuth();
  const token = useAuthToken();
  const meads = useFinishedMeads();
  const organization = useQuery({
    queryKey: ["account", "inventory-organization", user?.id],
    enabled: !!user,
    retry: false,
    queryFn: async () => {
      const response = await fetch("/api/account/inventory/organization", {
        cache: "no-store",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) throw new Error("FAILED");
      return inventoryOrganizationResponseSchema.parse(await response.json());
    },
  });
  let rows: ReturnType<typeof productionBottleRows> = [];
  let invalid = false;
  try {
    rows = kind === "remove" ? [] : productionBottleRows(data);
  } catch {
    invalid = true;
  }
  const [track, setTrack] = useState(!!source?.outputs.length);
  const [newName, setNewName] = useState(
    name.trim().slice(0, 200) || t("bottlingInventory.defaultName"),
  );
  const [newId] = useState(() => crypto.randomUUID());
  const [mode, setMode] = useState<"sync" | "reconcile">(
    source?.reconciliation_required ? "reconcile" : "sync",
  );
  const [confirmed, setConfirmed] = useState(false);
  const [drafts, setDrafts] = useState<Draft[]>(() =>
    source?.outputs.length
      ? source.outputs.map((output) => ({
          id: crypto.randomUUID(),
          row_id: output.row_id,
          quantity: String(output.quantity),
          mead_id: output.mead_id,
          location_id: "unlocated",
          position: "",
        }))
      : rows.map((row) => ({
          id: crypto.randomUUID(),
          row_id: row.id,
          quantity: String(row.quantity),
          mead_id: "new",
          location_id: "unlocated",
          position: "",
        })),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const attempt = useRef<{ signature: string; id: string } | null>(null);
  const patch = (key: string, value: Partial<Draft>) =>
    setDrafts((current) =>
      current.map((row) => (row.id === key ? { ...row, ...value } : row)),
    );
  const needsConfirmation =
    mode === "reconcile" ||
    (kind === "edit" && !source?.outputs.length && track);
  const remainingFor = (id: string, quantity: number) =>
    quantity -
    drafts
      .filter((row) => row.row_id === id)
      .reduce((sum, row) => sum + (Number(row.quantity) || 0), 0);
  const number = (value: number) =>
    new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 6 }).format(
      value,
    );
  async function submit() {
    try {
      const body = {
        expected_revision: source?.revision ?? null,
        mode,
        confirmed_on_hand: confirmed,
        outputs:
          kind === "remove" || !track
            ? []
            : drafts
                .filter((draft) => rows.some((row) => row.id === draft.row_id))
                .map((row) => ({
                  row_id: row.row_id,
                  quantity: Number(row.quantity),
                  target:
                    row.mead_id === "new"
                      ? { kind: "new" as const, mead_id: newId, name: newName }
                      : { kind: "existing" as const, mead_id: row.mead_id },
                  location_id:
                    row.location_id === "unlocated" ? null : row.location_id,
                  position: row.position,
                })),
      };
      if (
        body.outputs.some(
          (row) =>
            !choices.some(
              (choice) =>
                choice.id ===
                (row.target.kind === "new" ? "new" : row.target.mead_id),
            ) ||
            (row.location_id &&
              !locations.some((location) => location.id === row.location_id)) ||
            (row.target.kind === "new" && !row.target.name.trim()),
        )
      )
        throw new Error("LINK_MISMATCH");
      if (body.outputs.some((row) => !row.quantity))
        throw new Error("INVALID_QUANTITY");
      const signature = JSON.stringify(body);
      if (attempt.current?.signature !== signature)
        attempt.current = { signature, id: crypto.randomUUID() };
      const selection = bottlingSelectionSchema.parse({
        ...body,
        operation_id: attempt.current.id,
      });
      validateBottlingOutputs(rows, selection.outputs);
      if (needsConfirmation && !confirmed)
        throw new Error("RECONCILIATION_REQUIRED");
      setBusy(true);
      setError("");
      await onSave(selection);
    } catch (error) {
      const code =
        error && typeof error === "object" && "body" in error
          ? String((error.body as { code?: string })?.code ?? "FAILED")
          : error && typeof error === "object" && "code" in error
            ? String(error.code)
            : error instanceof Error
              ? error.name === "ZodError"
                ? "INVALID_QUANTITY"
                : error.message
              : "FAILED";
      setError(t(`bottlingInventory.errors.${code}`, t("inventory.saveError")));
    } finally {
      setBusy(false);
    }
  }
  const preview = new Map<
    string,
    {
      name: string;
      size: number;
      meadId: string;
      previous: number;
      next: number;
    }
  >();
  for (const output of source?.outputs ?? []) {
    const key = JSON.stringify([output.mead_id, output.size_liters]);
    const row = preview.get(key) ?? {
      name: output.name,
      size: output.size_liters,
      meadId: output.mead_id,
      previous: 0,
      next: 0,
    };
    row.previous += output.quantity;
    preview.set(key, row);
  }
  if (track && kind !== "remove")
    for (const draft of drafts) {
      const sourceRow = rows.find((row) => row.id === draft.row_id);
      if (!sourceRow) continue;
      const meadId = draft.mead_id === "new" ? newId : draft.mead_id;
      const key = JSON.stringify([meadId, sourceRow.sizeLiters]);
      const row = preview.get(key) ?? {
        name:
          draft.mead_id === "new"
            ? newName
            : (meads.overview.data?.meads.find((mead) => mead.id === meadId)
                ?.name ?? ""),
        size: sourceRow.sizeLiters,
        meadId,
        previous: 0,
        next: 0,
      };
      row.next += Number(draft.quantity) || 0;
      preview.set(key, row);
    }
  const choices = [
    ...(mode === "sync"
      ? [{ id: "new", name: t("bottlingInventory.newEntry") }]
      : []),
    ...(meads.overview.data?.meads ?? []).map((mead) => ({
      id: mead.id,
      name: mead.name,
    })),
    ...(source?.outputs ?? [])
      .filter(
        (output) =>
          !meads.overview.data?.meads.some(
            (mead) => mead.id === output.mead_id,
          ),
      )
      .map((output) => ({ id: output.mead_id, name: output.name })),
  ];
  const locations = [
    { id: "unlocated", name: t("inventory.organization.unlocated") },
    ...(organization.data?.locations ?? []).map((location) => ({
      id: location.id,
      name: location.path,
    })),
  ];
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onCancel();
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {t(
              kind === "remove"
                ? "bottlingInventory.removeTitle"
                : "bottlingInventory.title",
            )}
          </DialogTitle>
          <DialogDescription>
            {t(
              kind === "remove"
                ? "bottlingInventory.removeHelp"
                : "bottlingInventory.help",
            )}
          </DialogDescription>
        </DialogHeader>
        {invalid ? (
          <p role="alert">{t("bottlingInventory.errors.ENTRY_MISMATCH")}</p>
        ) : (
          <>
            {kind !== "remove" ? (
              <label className="flex items-start gap-2 text-sm">
                <Checkbox
                  checked={track}
                  disabled={busy || !!source?.outputs.length}
                  onCheckedChange={(value) => setTrack(value === true)}
                />
                {t("bottlingInventory.track")}
              </label>
            ) : null}
            {track || kind === "remove" ? (
              <>
                {meads.overview.isPending || organization.isPending ? (
                  <p role="status" className="text-sm text-muted-foreground">
                    {t("inventory.loading")}
                  </p>
                ) : null}
                {meads.overview.isError || organization.isError ? (
                  <div role="alert" className="space-y-2 text-sm">
                    <p>{t("inventory.loadError")}</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        void meads.overview.refetch();
                        void organization.refetch();
                      }}
                    >
                      {t("equipment.retry")}
                    </Button>
                  </div>
                ) : null}
              </>
            ) : null}
            {kind !== "remove" && !rows.length ? (
              <p className="text-sm text-muted-foreground">
                {t("bottlingInventory.noRows")}
              </p>
            ) : null}
            {source?.reconciliation_required ? (
              <p className="text-sm text-destructive">
                {t("bottlingInventory.pending")}
              </p>
            ) : null}
            {track || kind === "remove" ? (
              <div className="space-y-2">
                <Label htmlFor={`${id}-mode`}>
                  {t("bottlingInventory.correctionMode")}
                </Label>
                <Select
                  value={mode}
                  disabled={busy || source?.reconciliation_required}
                  onValueChange={(value: "sync" | "reconcile") => {
                    setMode(value);
                    if (value === "reconcile")
                      setDrafts((current) =>
                        current.map((row) =>
                          row.mead_id === "new"
                            ? {
                                ...row,
                                mead_id:
                                  source?.outputs[0]?.mead_id ??
                                  meads.overview.data?.meads[0]?.id ??
                                  "",
                              }
                            : row,
                        ),
                      );
                  }}
                >
                  <SelectTrigger id={`${id}-mode`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sync">
                      {t("bottlingInventory.applyDifference")}
                    </SelectItem>
                    <SelectItem value="reconcile">
                      {t("bottlingInventory.reconcile")}
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {t(
                    mode === "reconcile"
                      ? "bottlingInventory.reconcileHelp"
                      : "bottlingInventory.differenceHelp",
                  )}
                </p>
              </div>
            ) : null}
            {kind === "remove" ? (
              <ul className="space-y-2">
                {source?.outputs.map((output, index) => (
                  <li key={index} className="text-sm">
                    {output.name} · {number(output.quantity)} ×{" "}
                    {number(output.size_liters * 1000)} mL
                  </li>
                ))}
              </ul>
            ) : null}
            {track && kind !== "remove" ? (
              <>
                {drafts.some((row) => row.mead_id === "new") ? (
                  <div className="space-y-2">
                    <Label htmlFor={`${id}-name`}>{t("inventory.name")}</Label>
                    <Input
                      id={`${id}-name`}
                      value={newName}
                      disabled={busy}
                      maxLength={200}
                      onChange={(event) => setNewName(event.target.value)}
                    />
                  </div>
                ) : null}
                <p className="text-xs text-muted-foreground">
                  {t("bottlingInventory.storageHelp")}
                </p>
                {rows.map((row) => (
                  <fieldset
                    key={row.id}
                    disabled={busy}
                    className="space-y-3 rounded-lg border p-3"
                  >
                    <legend className="px-1 text-sm font-medium">
                      {number(row.quantity)} × {number(row.sizeLiters * 1000)}{" "}
                      mL
                    </legend>
                    {drafts
                      .filter((draft) => draft.row_id === row.id)
                      .map((draft) => (
                        <div key={draft.id} className="space-y-3 border-b pb-3">
                          <Label htmlFor={`${id}-${draft.id}-mead`}>
                            {t("bottlingInventory.entry")}
                          </Label>
                          <SearchableInput
                            openOnFocus={false}
                            dropdownPortal
                            id={`${id}-${draft.id}-mead`}
                            items={choices}
                            keyName="name"
                            getValue={(item) => item.id}
                            query={draft.mead_id}
                            setQuery={(value) =>
                              patch(draft.id, { mead_id: value })
                            }
                            onSelect={(item) =>
                              patch(draft.id, { mead_id: item.id })
                            }
                          />
                          <Label htmlFor={`${id}-${draft.id}-count`}>
                            {t(
                              mode === "reconcile"
                                ? "bottlingInventory.producedBottles"
                                : "bottlingInventory.bottlesToTrack",
                            )}
                          </Label>
                          <AmountUnitField
                            id={`${id}-${draft.id}-count`}
                            amount={draft.quantity}
                            unit={t("inventory.meads.bottlesUnit")}
                            onAmountChange={(quantity) =>
                              patch(draft.id, { quantity })
                            }
                          />
                          {mode === "sync" ? (
                            <>
                              <Label htmlFor={`${id}-${draft.id}-location`}>
                                {t("bottlingInventory.addedLocation")}
                              </Label>
                              <SearchableInput
                                openOnFocus={false}
                                dropdownPortal
                                id={`${id}-${draft.id}-location`}
                                items={locations}
                                keyName="name"
                                getValue={(item) => item.id}
                                query={draft.location_id}
                                setQuery={(value) =>
                                  patch(draft.id, { location_id: value })
                                }
                                onSelect={(item) =>
                                  patch(draft.id, { location_id: item.id })
                                }
                              />
                              {draft.location_id !== "unlocated" ? (
                                <Input
                                  aria-label={t(
                                    "inventory.organization.position",
                                  )}
                                  value={draft.position}
                                  maxLength={200}
                                  placeholder={t(
                                    "inventory.organization.positionPlaceholder",
                                  )}
                                  onChange={(event) =>
                                    patch(draft.id, {
                                      position: event.target.value,
                                    })
                                  }
                                />
                              ) : null}
                            </>
                          ) : null}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setDrafts((current) =>
                                current.filter((row) => row.id !== draft.id),
                              )
                            }
                          >
                            {t("bottlingInventory.removeSplit")}
                          </Button>
                        </div>
                      ))}
                    <p
                      className={`text-xs ${remainingFor(row.id, row.quantity) < 0 ? "text-destructive" : "text-muted-foreground"}`}
                    >
                      {t(
                        remainingFor(row.id, row.quantity) < 0
                          ? "bottlingInventory.overAssigned"
                          : "bottlingInventory.untrackedCount",
                        { count: Math.abs(remainingFor(row.id, row.quantity)) },
                      )}
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={drafts.length >= 100}
                      onClick={() =>
                        setDrafts((current) => [
                          ...current,
                          {
                            id: crypto.randomUUID(),
                            row_id: row.id,
                            quantity: "",
                            mead_id:
                              mode === "sync"
                                ? "new"
                                : (source?.outputs[0]?.mead_id ??
                                  meads.overview.data?.meads[0]?.id ??
                                  ""),
                            location_id: "unlocated",
                            position: "",
                          },
                        ])
                      }
                    >
                      {t("bottlingInventory.split")}
                    </Button>
                  </fieldset>
                ))}
                {drafts.some(
                  (draft) => !rows.some((row) => row.id === draft.row_id),
                ) ? (
                  <p className="text-sm">
                    {t("bottlingInventory.removedRows")}
                  </p>
                ) : null}
              </>
            ) : null}
            {preview.size ? (
              <section className="space-y-2 rounded-lg border p-3">
                <h3 className="text-sm font-medium">
                  {t("bottlingInventory.balancePreview")}
                </h3>
                <ul className="space-y-2 text-sm">
                  {[...preview.entries()].map(([key, row]) => {
                    const before =
                      row.meadId === newId
                        ? 0
                        : meads.overview.data?.meads
                            .find((mead) => mead.id === row.meadId)
                            ?.bottles.find(
                              (bottle) =>
                                Math.abs(bottle.size_liters - row.size) <
                                0.0000005,
                            )?.quantity;
                    const delta =
                      mode === "reconcile" ? 0 : row.next - row.previous;
                    return (
                      <li key={key}>
                        {row.name} · {number(row.size * 1000)} mL
                        <br />
                        {t("bottlingInventory.balanceLine", {
                          before: before === undefined ? "—" : number(before),
                          after:
                            before === undefined ? "—" : number(before + delta),
                          delta: new Intl.NumberFormat(i18n.language, {
                            signDisplay: "always",
                          }).format(delta),
                        })}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ) : null}
            {packaging?.mode === "items" ? (
              <p className="text-sm text-muted-foreground">
                {t("bottlingInventory.packagingSummary", {
                  count:
                    kind === "remove"
                      ? packaging.expected.length
                      : packaging.items.filter((item) => item.stock_id).length,
                })}
              </p>
            ) : null}
            {needsConfirmation ? (
              <label className="flex items-start gap-2 text-sm">
                <Checkbox
                  checked={confirmed}
                  disabled={busy}
                  onCheckedChange={(value) => setConfirmed(value === true)}
                />
                {t(
                  mode === "reconcile"
                    ? "bottlingInventory.confirmReconcile"
                    : "bottlingInventory.confirmOlder",
                )}
              </label>
            ) : null}
            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}
          </>
        )}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={onCancel}
          >
            {t("equipment.cancel")}
          </Button>
          <LoadingButton
            loading={busy}
            loadingText={t("equipment.saving")}
            disabled={
              invalid ||
              ((track || kind === "remove") &&
                (meads.overview.isPending ||
                  meads.overview.isError ||
                  organization.isPending ||
                  organization.isError))
            }
            onClick={() => void submit()}
          >
            {t("bottlingInventory.save")}
          </LoadingButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

"use client";
import { useId, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { validateAllocationTotal } from "@meadtools/inventory-domain";
import type { InventoryOrganizedStock } from "@meadtools/api-contract/contracts";
import { updateInventoryStorageRequestBodySchema } from "@meadtools/api-contract/inventory";
import {
  useInventoryOrganization,
  useStorageHistory,
  targetLabels,
  type OrganizationCommand,
} from "./InventoryOrganizationProvider";
import { organizationError } from "./InventoryOrganizationManager";
import { isValidNumber, parseNumber } from "@/lib/utils/validateInput";
import SearchableInput from "@/components/ui/SearchableInput";
import { AmountUnitField } from "@/components/ui/amount-unit-field";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectTrigger,
  SelectValue,
  SelectItem,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export function InventoryOrganizeDialog({
  kind,
  id,
  name,
  onClose,
}: {
  kind: "stock" | "mead";
  id: string;
  name: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { overview, mutation } = useInventoryOrganization();
  const canManage = overview.data?.can_manage === true;
  const stocks =
    overview.data?.stock.filter((row) =>
      kind === "stock" ? row.id === id : row.mead_id === id,
    ) ?? [];
  const [selected, setSelected] = useState(stocks[0]?.id ?? "");
  const stock = stocks.find((row) => row.id === selected);
  async function save(command: OrganizationCommand) {
    if (!canManage) return;
    try {
      await mutation.mutateAsync(command);
      onClose();
    } catch {
      /* Keep original reviewed storage/labels. */
    }
  }
  const error = organizationError(mutation.error, t);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !mutation.isPending) onClose();
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {t(
              canManage
                ? "inventory.organization.organize"
                : "inventory.organization.storageHistory",
            )}
          </DialogTitle>
          <DialogDescription>{name}</DialogDescription>
        </DialogHeader>
        {canManage ? (
          <Tabs defaultValue="categories">
            <TabsList>
              <TabsTrigger value="categories">
                {t("inventory.organization.categories")}
              </TabsTrigger>
              <TabsTrigger value="storage">
                {t("inventory.organization.storage")}
              </TabsTrigger>
              <TabsTrigger value="history">
                {t("inventory.organization.storageHistory")}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="categories">
              <CategoryEditor
                kind={kind}
                targetId={id}
                busy={mutation.isPending}
                error={error}
                onSave={save}
              />
            </TabsContent>
            <TabsContent value="storage">
              {stocks.length > 1 ? (
                <StockChoice
                  stocks={stocks}
                  selected={selected}
                  onSelect={setSelected}
                  disabled={mutation.isPending}
                />
              ) : null}
              {stock ? (
                <StorageEditor
                  key={stock.id}
                  stock={stock}
                  busy={mutation.isPending}
                  error={error}
                  onSave={save}
                />
              ) : (
                <p>{t("inventory.organization.noStock")}</p>
              )}
            </TabsContent>
            <TabsContent value="history">
              {stocks.length > 1 ? (
                <StockChoice
                  stocks={stocks}
                  selected={selected}
                  onSelect={setSelected}
                  disabled={mutation.isPending}
                />
              ) : null}
              {stock ? <StorageHistory stock={stock} /> : null}
            </TabsContent>
          </Tabs>
        ) : (
          <>
            {stocks.length > 1 ? (
              <StockChoice
                stocks={stocks}
                selected={selected}
                onSelect={setSelected}
                disabled={false}
              />
            ) : null}
            {stock ? <StorageHistory stock={stock} /> : null}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
function StockChoice({
  stocks,
  selected,
  onSelect,
  disabled,
}: {
  stocks: InventoryOrganizedStock[];
  selected: string;
  onSelect: (value: string) => void;
  disabled: boolean;
}) {
  const { t, i18n } = useTranslation();
  const id = useId();
  return (
    <div className="my-4 space-y-2">
      <Label htmlFor={id}>{t("inventory.meads.bottleSize")}</Label>
      <Select value={selected} onValueChange={onSelect} disabled={disabled}>
        <SelectTrigger id={id}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {stocks.map((stock) => (
            <SelectItem key={stock.id} value={stock.id}>
              {new Intl.NumberFormat(i18n.language).format(
                (stock.bottle_size_liters ?? 0) * 1000,
              )}{" "}
              mL · {stock.quantity.value} {t("inventory.meads.bottlesUnit")}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
function CategoryEditor({
  kind,
  targetId,
  busy,
  error,
  onSave,
}: {
  kind: "stock" | "mead";
  targetId: string;
  busy: boolean;
  error: string;
  onSave: (command: OrganizationCommand) => Promise<void>;
}) {
  const { t } = useTranslation();
  const { overview } = useInventoryOrganization();
  const [expected] = useState(() =>
    targetLabels(overview.data, kind, targetId),
  );
  const [labels, setLabels] = useState(expected);
  const [query, setQuery] = useState("");
  const [fieldKey, setFieldKey] = useState(0);
  const id = useId();
  const choices =
    overview.data?.labels.filter((label) => !labels.includes(label.id)) ?? [];
  return (
    <div className="space-y-4 py-3">
      <p className="text-sm text-muted-foreground">
        {t("inventory.organization.categoryHelp")}
      </p>
      <div className="flex flex-wrap gap-2">
        {labels.map((labelId) => (
          <Button
            key={labelId}
            variant="secondary"
            size="sm"
            className="h-auto max-w-full whitespace-normal rounded-full"
            disabled={busy}
            onClick={() =>
              setLabels((current) =>
                current.filter((value) => value !== labelId),
              )
            }
            aria-label={t("inventory.organization.removeCategory", {
              name: overview.data?.labels.find((row) => row.id === labelId)
                ?.name,
            })}
          >
            {overview.data?.labels.find((row) => row.id === labelId)?.name}
            <X aria-hidden className="ml-1 h-3 w-3 shrink-0" />
          </Button>
        ))}
      </div>
      <Label htmlFor={id}>{t("inventory.organization.addCategory")}</Label>
      <SearchableInput
        openOnFocus={false}
        key={fieldKey}
        id={id}
        query={query}
        setQuery={setQuery}
        items={choices}
        keyName="name"
        disabled={busy || labels.length >= 50}
        onSelect={(label) => {
          setLabels((current) => [...current, label.id]);
          setQuery("");
          setFieldKey((key) => key + 1);
        }}
      />
      {!overview.data?.labels.length ? (
        <p className="text-sm text-muted-foreground">
          {t("inventory.organization.createCategoryHelp")}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <LoadingButton
        loading={busy}
        loadingText={t("equipment.saving")}
        onClick={() =>
          void onSave({
            change: {
              action: "assign_labels",
              kind,
              id: targetId,
              label_ids: labels,
              expected_label_ids: expected,
            },
          })
        }
      >
        {t("inventory.organization.saveCategories")}
      </LoadingButton>
    </div>
  );
}
type AllocationDraft = {
  key: string;
  location_id: string;
  position: string;
  quantity: string;
};
function StorageEditor({
  stock,
  busy,
  error,
  onSave,
}: {
  stock: InventoryOrganizedStock;
  busy: boolean;
  error: string;
  onSave: (command: OrganizationCommand) => Promise<void>;
}) {
  const { t, i18n } = useTranslation();
  const { overview } = useInventoryOrganization();
  const [snapshot] = useState(stock);
  const [rows, setRows] = useState<AllocationDraft[]>(() =>
    stock.allocations.map((row) => ({
      ...row,
      key: crypto.randomUUID(),
      quantity: String(row.quantity),
    })),
  );
  const [invalid, setInvalid] = useState(false);
  const id = useId();
  const numeric = (value: string) =>
    value.trim() && isValidNumber(value) ? parseNumber(value) : NaN;
  let unlocated: number | null = null;
  try {
    unlocated = validateAllocationTotal(
      snapshot.quantity,
      rows.map((row) => numeric(row.quantity)),
    );
  } catch {
    /* Show validation on save. */
  }
  const format = (value: number) =>
    new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 6 }).format(
      value,
    );
  function patch(key: string, value: Partial<AllocationDraft>) {
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, ...value } : row)),
    );
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    const input = updateInventoryStorageRequestBodySchema.safeParse({
      operation_id: crypto.randomUUID(),
      expected_revision: snapshot.revision,
      allocations: rows.map((row) => ({
        location_id: row.location_id,
        position: row.position,
        quantity: numeric(row.quantity),
      })),
    });
    if (!input.success || unlocated === null) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    await onSave({
      stock_id: stock.id,
      storage: {
        expected_revision: snapshot.revision,
        allocations: input.data.allocations,
      },
    });
  }
  const locations =
    overview.data?.locations.map((row) => ({ ...row, name: row.path })) ?? [];
  return (
    <form onSubmit={submit} className="space-y-4 py-3">
      <p className="text-sm">
        {t("inventory.organization.onHand", {
          amount: format(snapshot.quantity.value),
          unit: t(
            snapshot.mead_id
              ? "inventory.meads.bottlesUnit"
              : `inventory.units.${snapshot.quantity.unit}`,
          ),
        })}
      </p>
      <p className="text-sm text-muted-foreground">
        {t("inventory.organization.storageHelp")}
      </p>
      {rows.map((row, index) => (
        <fieldset
          key={row.key}
          disabled={busy}
          className="space-y-3 rounded-lg border p-3"
        >
          <legend className="px-1 text-sm font-medium">
            {t("inventory.organization.positionNumber", { count: index + 1 })}
          </legend>
          <div className="space-y-2">
            <Label htmlFor={`${id}-location-${row.key}`}>
              {t("inventory.organization.location")}
            </Label>
            <SearchableInput
              openOnFocus={false}
              id={`${id}-location-${row.key}`}
              items={locations}
              keyName="name"
              getValue={(item) => item.id}
              query={row.location_id}
              setQuery={(value) => patch(row.key, { location_id: value })}
              onSelect={(location) =>
                patch(row.key, { location_id: location.id })
              }
              disabled={busy}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${id}-position-${row.key}`}>
              {t("inventory.organization.position")}
            </Label>
            <Input
              id={`${id}-position-${row.key}`}
              value={row.position}
              onChange={(event) =>
                patch(row.key, { position: event.target.value })
              }
              maxLength={200}
              placeholder={t("inventory.organization.positionPlaceholder")}
              disabled={busy}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${id}-amount-${row.key}`}>
              {t("inventory.quantity")}
            </Label>
            <AmountUnitField
              id={`${id}-amount-${row.key}`}
              amount={row.quantity}
              unit={t(
                snapshot.mead_id
                  ? "inventory.meads.bottlesUnit"
                  : `inventory.units.${snapshot.quantity.unit}`,
              )}
              onAmountChange={(quantity) => patch(row.key, { quantity })}
              disabled={busy}
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() =>
              setRows((current) =>
                current.filter((item) => item.key !== row.key),
              )
            }
          >
            {t("inventory.organization.removePosition")}
          </Button>
        </fieldset>
      ))}
      <Button
        type="button"
        variant="outline"
        disabled={busy || !locations.length || rows.length >= 100}
        onClick={() =>
          setRows((current) => [
            ...current,
            {
              key: crypto.randomUUID(),
              location_id: "",
              position: "",
              quantity: "",
            },
          ])
        }
      >
        {t("inventory.organization.addPosition")}
      </Button>
      {!locations.length ? (
        <p className="text-sm text-muted-foreground">
          {t("inventory.organization.createLocationHelp")}
        </p>
      ) : null}
      <p className="text-sm font-medium" role="status">
        {t("inventory.organization.unlocatedAmount", {
          amount: unlocated === null ? "—" : format(unlocated),
          unit: t(
            snapshot.mead_id
              ? "inventory.meads.bottlesUnit"
              : `inventory.units.${snapshot.quantity.unit}`,
          ),
        })}
      </p>
      <p className="text-xs text-muted-foreground">
        {t("inventory.organization.deductionOrder")}
      </p>
      {invalid || error ? (
        <p role="alert" className="text-sm text-destructive">
          {invalid ? t("inventory.organization.invalidAllocations") : error}
        </p>
      ) : null}
      <LoadingButton
        type="submit"
        loading={busy}
        loadingText={t("equipment.saving")}
      >
        {t("inventory.organization.saveStorage")}
      </LoadingButton>
    </form>
  );
}
function StorageHistory({ stock }: { stock: InventoryOrganizedStock }) {
  const { t, i18n } = useTranslation();
  const query = useStorageHistory(stock.id);
  if (query.isPending) return <p role="status">{t("inventory.loading")}</p>;
  if (query.isError)
    return (
      <div role="alert">
        <p>{t("inventory.loadError")}</p>
        <Button onClick={() => void query.refetch()}>
          {t("equipment.retry")}
        </Button>
      </div>
    );
  return (
    <div className="space-y-3 py-3">
      {query.data.changes.length ? (
        <ol className="space-y-4">
          {query.data.changes.map((change) => (
            <li key={change.id} className="space-y-1 border-b pb-3 text-sm">
              <p className="font-medium">
                {change.location_path}
                {change.position ? ` · ${change.position}` : ""}
              </p>
              <p>
                {new Intl.NumberFormat(i18n.language, {
                  signDisplay: "exceptZero",
                  maximumFractionDigits: 6,
                }).format(change.delta)}{" "}
                {t(
                  stock.mead_id
                    ? "inventory.meads.bottlesUnit"
                    : `inventory.units.${change.unit}`,
                )}{" "}
                ·{" "}
                {t(
                  change.reason === "move"
                    ? "inventory.organization.moved"
                    : "inventory.organization.balanceChange",
                )}
              </p>
              <time
                dateTime={change.created_at}
                className="text-muted-foreground"
              >
                {new Intl.DateTimeFormat(i18n.language, {
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(new Date(change.created_at))}
              </time>
            </li>
          ))}
        </ol>
      ) : (
        <p>{t("inventory.organization.noMovements")}</p>
      )}
      {query.data.has_more ? (
        <p className="text-sm text-muted-foreground">
          {t("inventory.recentHistory")}
        </p>
      ) : null}
    </div>
  );
}

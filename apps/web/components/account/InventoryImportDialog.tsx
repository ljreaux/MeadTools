"use client";
import { useId, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  suggestTransferCatalog,
  resolveTransferStockIdentity,
  FILE_BYTE_LIMIT,
  IMPORT_ROW_LIMIT,
  normalizeTransferRow,
  suggestTransferMapping,
  transferFields,
  nutrientCatalog,
  stabilizerCatalog,
  type TransferMapping,
  type TransferField,
  type CatalogReference,
} from "@meadtools/inventory-domain";
import type {
  InventoryStockItem,
  InventoryTransferRequestBody,
  InventoryTransferResponse,
} from "@meadtools/api-contract/contracts";
import { useIngredientsQuery } from "@/hooks/reactQuery/useIngredientsQuery";
import { useYeastsQuery } from "@/hooks/reactQuery/useYeastsQuery";
import { useAdditivesQuery } from "@/hooks/reactQuery/useAdditivesQuery";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/Checkbox";
import SearchableInput from "@/components/ui/SearchableInput";
import { inventoryCategories } from "./InventoryEditor";
import {
  downloadTransferFile,
  transferErrorCode,
} from "./InventoryTransferActions";
import { toast } from "@/hooks/use-toast";
type Sheet = { name: string; rows: string[][] };
const getValue = (item: { id: string }) => item.id;
const referenceKey = (ref: CatalogReference) => `${ref.catalog}:${ref.id}`;
export function InventoryImportDialog({
  stock,
  request,
  onClose,
  onImported,
}: {
  stock: InventoryStockItem[];
  request: (
    body: InventoryTransferRequestBody,
  ) => Promise<InventoryTransferResponse>;
  onClose: () => void;
  onImported: () => void;
}) {
  const { t, i18n } = useTranslation();
  const [stockAtOpen] = useState(() => stock);
  const stockById = useMemo(
    () => new Map(stockAtOpen.map((item) => [item.id, item])),
    [stockAtOpen],
  );
  const id = useId();
  const title = useRef<HTMLHeadingElement>(null);
  const [step, setStep] = useState<"file" | "map" | "review">("file");
  const [file, setFile] = useState<File | null>(null);
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [header, setHeader] = useState(0);
  const [mappingOverrides, setMapping] = useState<
    Partial<Record<TransferField, number | null>>
  >({});
  const [delimiter, setDelimiter] = useState<"auto" | "," | ";" | "\t">("auto");
  const [decimal, setDecimal] = useState<"." | ",">(".");
  const [defaultCategory, setDefaultCategory] = useState("");
  const [defaultUnit, setDefaultUnit] = useState("");
  const [extraNotes, setExtraNotes] = useState<number[]>([]);
  const [mode, setMode] = useState<"create" | "update">("create");
  const [excluded, setExcluded] = useState<Record<number, boolean>>({});
  const [overrides, setReferences] = useState<
    Record<number, CatalogReference | null>
  >({});
  const [queries, setQueries] = useState<Record<number, string>>({});
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const [error, setError] = useState("");
  const attempt = useRef<{ signature: string; id: string } | null>(null);
  const ingredients = useIngredientsQuery();
  const yeasts = useYeastsQuery();
  const additives = useAdditivesQuery();
  const catalog = useMemo(
    () => [
      ...(ingredients.data ?? []).map((item) => ({
        name: item.name,
        ref: { catalog: "ingredient" as const, id: String(item.id) },
      })),
      ...(yeasts.data ?? []).map((item) => ({
        name: `${item.brand} ${item.name}`,
        ref: { catalog: "yeast" as const, id: String(item.id) },
      })),
      ...(additives.data ?? []).map((item) => ({
        name: item.name,
        ref: { catalog: "additive" as const, id: item.id },
      })),
      ...nutrientCatalog.map((item) => ({
        name: item.name,
        ref: { catalog: "nutrient" as const, id: item.id },
      })),
      ...stabilizerCatalog.map((item) => ({
        name: item.name,
        ref: { catalog: "additive" as const, id: item.id },
      })),
    ],
    [ingredients.data, yeasts.data, additives.data],
  );
  const sheet = sheets[sheetIndex];
  const headers = sheet?.rows[header] ?? [];
  const mapping = useMemo(() => {
    const value: TransferMapping = suggestTransferMapping(headers);
    for (const field of transferFields) {
      const override = mappingOverrides[field];
      if (override === null) delete value[field];
      else if (override !== undefined) value[field] = override;
    }
    return value;
  }, [headers, mappingOverrides]);
  const rows = useMemo(() => {
    const cache = new Map<
      string,
      { reference: CatalogReference | null; warning: boolean }
    >();
    return (sheet?.rows ?? []).slice(header + 1).flatMap((cells, index) => {
      if (cells.every((cell) => !cell.trim())) return [];
      const parsed = normalizeTransferRow(
        cells,
        mapping,
        decimal,
        extraNotes,
        { category: defaultCategory, unit: defaultUnit },
        headers,
      );
      let suggestion = {
        reference: null as CatalogReference | null,
        warning: false,
      };
      if (
        parsed.stock &&
        !parsed.stock.catalogReference &&
        !parsed.stockId &&
        parsed.stock.category !== "packaging"
      ) {
        const stock = parsed.stock;
        const name = parsed.catalogName || stock.name;
        const key = `${stock.category}:${name}`;
        const saved = cache.get(key);
        if (saved) suggestion = saved;
        else {
          suggestion = suggestTransferCatalog(name, stock.category, catalog);
          cache.set(key, suggestion);
        }
      }
      return [{ ...parsed, rowNumber: header + index + 2, suggestion }];
    });
  }, [
    sheet,
    header,
    mapping,
    decimal,
    extraNotes,
    defaultCategory,
    defaultUnit,
    headers,
    catalog,
  ]);
  const reviewed = rows.map((row) => {
    const existing = row.stockId ? stockById.get(row.stockId) : undefined;
    const identity = resolveTransferStockIdentity(mode, row.stockId, stockById);
    const skip = excluded[row.rowNumber] ?? identity.skipByDefault;
    const stockInput = row.stock
      ? {
          ...row.stock,
          catalogReference:
            overrides[row.rowNumber] !== undefined
              ? overrides[row.rowNumber]
              : (row.stock.catalogReference ?? row.suggestion.reference),
        }
      : null;
    const errors = row.errors.filter(
      (error) => error !== "catalog" || overrides[row.rowNumber] === undefined,
    );
    if (
      stockInput?.catalogReference &&
      catalog.length &&
      !catalog.some(
        (item) =>
          referenceKey(item.ref) === referenceKey(stockInput.catalogReference!),
      )
    )
      errors.push("catalog");
    if (mode === "update" && row.stockId && !existing) errors.push("stock_id");
    if (
      existing &&
      mode === "update" &&
      stockInput &&
      (existing.quantity.unit !== stockInput.quantity.unit ||
        existing.category !== stockInput.category)
    )
      errors.push("updateUnit");
    if (existing?.reconciliation_required && mode === "update")
      errors.push("reconciliation");
    return { ...row, existing, identity, skip, stockInput, errors };
  });
  const selectedIds = new Map<string, number>();
  for (const row of reviewed)
    if (!row.skip && row.identity.stockId)
      selectedIds.set(
        row.identity.stockId,
        (selectedIds.get(row.identity.stockId) ?? 0) + 1,
      );
  for (const row of reviewed)
    if (
      !row.skip &&
      row.identity.stockId &&
      (selectedIds.get(row.identity.stockId) ?? 0) > 1
    )
      row.errors.push("duplicateId");
  const selected = reviewed.filter((row) => !row.skip);
  const invalid = selected.filter(
    (row) => row.errors.length || !row.stockInput,
  );
  const ready = Boolean(
    selected.length && selected.length <= IMPORT_ROW_LIMIT && !invalid.length,
  );
  const number = (value: number) =>
    new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 6 }).format(
      value,
    );
  function report(error: unknown) {
    const row =
      error && typeof error === "object" && "body" in error
        ? (error.body as { row_number?: number })?.row_number
        : undefined;
    const message = t(
      `inventory.transfer.errors.${transferErrorCode(error) ?? "FAILED"}`,
      t("inventory.transfer.errors.FAILED"),
    );
    setError(
      row ? `${t("inventory.transfer.row", { row })}: ${message}` : message,
    );
  }
  function resetMapping() {
    setMapping({});
    setExtraNotes([]);
    setExcluded({});
    setReferences({});
    setQueries({});
    setPage(0);
  }
  function nextStep(value: typeof step) {
    setError("");
    setStep(value);
    requestAnimationFrame(() => title.current?.focus());
  }
  async function inspect() {
    if (!file || inFlight.current) return;
    if (file.size > FILE_BYTE_LIMIT) {
      setError(t("inventory.transfer.errors.IMPORT_LIMIT"));
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      const content = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1]);
        reader.onerror = () => reject(new Error());
        reader.readAsDataURL(file);
      });
      const result = await request({
        action: "inspect",
        filename: file.name,
        content,
        delimiter,
      });
      if (result.kind !== "sheets") throw new Error();
      setSheets(result.sheets);
      const index = Math.max(
        0,
        result.sheets.findIndex((item) => item.name === "Inventory"),
      );
      setSheetIndex(index);
      const candidate = result.sheets[index];
      let best = 0;
      let score = 0;
      candidate.rows.slice(0, 50).forEach((row, index) => {
        const count = Object.keys(suggestTransferMapping(row)).length;
        if (count > score) {
          score = count;
          best = index;
        }
      });
      setHeader(best);
      resetMapping();
      nextStep("map");
    } catch (error) {
      report(error);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  async function save() {
    if (!ready || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      const rows = selected.map((row) => {
        const old = row.existing;
        return {
          row_number: row.rowNumber,
          stock: row.stockInput!,
          ...(row.identity.stockId ? { stock_id: row.identity.stockId } : {}),
          ...(old && mode === "update"
            ? {
                expected: {
                  name: old.name,
                  category: old.category,
                  quantity: old.quantity,
                  notes: old.notes,
                  catalogReference: old.catalogReference,
                },
              }
            : {}),
        };
      });
      const signature = JSON.stringify({ mode, rows });
      if (attempt.current?.signature !== signature)
        attempt.current = { signature, id: crypto.randomUUID() };
      const result = await request({
        action: "import",
        operation_id: attempt.current.id,
        mode,
        rows,
      });
      if (result.kind !== "imported") throw new Error();
      toast({
        description: t("inventory.transfer.imported", {
          created: result.created,
          updated: result.updated,
        }),
      });
      onImported();
    } catch (error) {
      report(error);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  function errorReport() {
    const lines = [
      [t("inventory.transfer.rowNumber"), t("inventory.transfer.errorColumn")],
      ...reviewed
        .filter((row) => row.errors.length)
        .map((row) => [
          String(row.rowNumber),
          row.errors
            .map((error) =>
              t(
                `inventory.transfer.rowErrors.${error}`,
                t("inventory.transfer.rowErrors.row"),
              ),
            )
            .join("; "),
        ]),
    ];
    const text = lines
      .map((row) =>
        row.map((cell) => '"' + cell.replace(/"/g, '""') + '"').join(","),
      )
      .join("\r\n");
    const bytes = new TextEncoder().encode(text);
    downloadTransferFile({
      filename: "meadtools-inventory-errors.csv",
      media_type: "text/csv;charset=utf-8",
      content: btoa(
        Array.from(bytes, (byte) => String.fromCharCode(byte)).join(""),
      ),
    });
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent
        className="max-h-[90vh] overflow-y-auto sm:max-w-3xl"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          title.current?.focus();
        }}
        onEscapeKeyDown={(event) => {
          if (busy) event.preventDefault();
        }}
        onInteractOutside={(event) => {
          if (busy) event.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle ref={title} tabIndex={-1}>
            {t(`inventory.transfer.steps.${step}`)}
          </DialogTitle>
          <DialogDescription>
            {t("inventory.transfer.description")}
          </DialogDescription>
        </DialogHeader>
        {step === "file" ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={`${id}-file`}>
                {t("inventory.transfer.file")}
              </Label>
              <Input
                id={`${id}-file`}
                type="file"
                accept=".xlsx,.csv"
                disabled={busy}
                onChange={(event) => {
                  setFile(event.target.files?.[0] ?? null);
                  setError("");
                }}
              />
              <p className="text-sm text-muted-foreground">
                {t("inventory.transfer.limits")}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${id}-delimiter`}>
                {t("inventory.transfer.delimiter")}
              </Label>
              <Select
                value={delimiter}
                onValueChange={(value) =>
                  setDelimiter(value as typeof delimiter)
                }
                disabled={busy}
              >
                <SelectTrigger id={`${id}-delimiter`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["auto", ",", ";", "\t"] as const).map((value) => (
                    <SelectItem key={value} value={value}>
                      {t(
                        `inventory.transfer.delimiters.${value === "\t" ? "tab" : value === "," ? "comma" : value === ";" ? "semicolon" : "auto"}`,
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        ) : null}
        {step === "map" ? (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor={`${id}-sheet`}>
                  {t("inventory.transfer.sheet")}
                </Label>
                <Select
                  value={String(sheetIndex)}
                  onValueChange={(value) => {
                    setSheetIndex(Number(value));
                    setHeader(0);
                    resetMapping();
                  }}
                >
                  <SelectTrigger id={`${id}-sheet`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {sheets.map((sheet, index) => (
                      <SelectItem key={index} value={String(index)}>
                        {sheet.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${id}-header`}>
                  {t("inventory.transfer.headerRow")}
                </Label>
                <Input
                  id={`${id}-header`}
                  type="number"
                  min={1}
                  max={sheet?.rows.length || 1}
                  value={header + 1}
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    if (
                      Number.isInteger(value) &&
                      value >= 1 &&
                      value <= (sheet?.rows.length ?? 1)
                    ) {
                      setHeader(value - 1);
                      resetMapping();
                    }
                  }}
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {transferFields.map((field) => (
                <div key={field} className="space-y-2">
                  <Label htmlFor={`${id}-${field}`}>
                    {t(`inventory.transfer.fields.${field}`)}
                  </Label>
                  <Select
                    value={
                      mapping[field] === undefined
                        ? "none"
                        : String(mapping[field])
                    }
                    onValueChange={(value) => {
                      setMapping((old) => ({
                        ...old,
                        [field]: value === "none" ? null : Number(value),
                      }));
                      setReferences({});
                      setExcluded({});
                      setQueries({});
                    }}
                  >
                    <SelectTrigger id={`${id}-${field}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">
                        {t("inventory.transfer.notMapped")}
                      </SelectItem>
                      {headers.map((label, index) => (
                        <SelectItem key={index} value={String(index)}>
                          {index + 1}.{" "}
                          {label || t("inventory.transfer.blankHeader")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor={`${id}-default-category`}>
                  {t("inventory.transfer.defaultCategory")}
                </Label>
                <Select
                  value={defaultCategory || "none"}
                  onValueChange={(value) =>
                    setDefaultCategory(value === "none" ? "" : value)
                  }
                >
                  <SelectTrigger id={`${id}-default-category`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">
                      {t("inventory.transfer.noDefault")}
                    </SelectItem>
                    {inventoryCategories.map((value) => (
                      <SelectItem key={value} value={value}>
                        {t(`inventory.categories.${value}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${id}-default-unit`}>
                  {t("inventory.transfer.defaultUnit")}
                </Label>
                <Input
                  id={`${id}-default-unit`}
                  value={defaultUnit}
                  onChange={(event) => setDefaultUnit(event.target.value)}
                  placeholder="kg"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${id}-decimal`}>
                {t("inventory.transfer.decimal")}
              </Label>
              <Select
                value={decimal}
                onValueChange={(value) => setDecimal(value as typeof decimal)}
              >
                <SelectTrigger id={`${id}-decimal`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value=".">
                    {t("inventory.transfer.decimalPoint")}
                  </SelectItem>
                  <SelectItem value=",">
                    {t("inventory.transfer.decimalComma")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <fieldset className="space-y-2">
              <legend className="mb-2 text-sm font-medium">
                {t("inventory.transfer.extraNotes")}
              </legend>
              {headers.map((label, index) =>
                !Object.values(mapping).includes(index) ? (
                  <Label key={index} className="flex items-center gap-2">
                    <Checkbox
                      checked={extraNotes.includes(index)}
                      onCheckedChange={(checked) =>
                        setExtraNotes((old) =>
                          checked
                            ? [...old, index]
                            : old.filter((value) => value !== index),
                        )
                      }
                    />
                    {label || t("inventory.transfer.blankHeader")}
                  </Label>
                ) : null,
              )}
            </fieldset>
            <p className="text-sm text-muted-foreground">
              {t("inventory.transfer.mappingHelp")}
            </p>
          </div>
        ) : null}
        {step === "review" ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={`${id}-mode`}>
                {t("inventory.transfer.mode")}
              </Label>
              <Select
                value={mode}
                onValueChange={(value) => {
                  setMode(value as typeof mode);
                  setExcluded({});
                }}
                disabled={busy}
              >
                <SelectTrigger id={`${id}-mode`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="create">
                    {t("inventory.transfer.createMode")}
                  </SelectItem>
                  <SelectItem value="update">
                    {t("inventory.transfer.updateMode")}
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                {t(
                  mode === "create"
                    ? "inventory.transfer.createHelp"
                    : "inventory.transfer.updateHelp",
                )}
              </p>
            </div>
            <p role="status" className="text-sm">
              {t("inventory.transfer.summary", {
                selected: selected.length,
                total: rows.length,
                invalid: invalid.length,
              })}
            </p>
            {selected.length > IMPORT_ROW_LIMIT ? (
              <p role="alert" className="text-destructive">
                {t("inventory.transfer.errors.IMPORT_LIMIT")}
              </p>
            ) : null}
            {reviewed.slice(page * 25, (page + 1) * 25).map((row) => {
              const ref = row.stockInput?.catalogReference;
              const allowed = catalog.filter((item) =>
                row.stockInput?.category === "yeast"
                  ? item.ref.catalog === "yeast"
                  : row.stockInput?.category === "additive"
                    ? ["nutrient", "additive"].includes(item.ref.catalog)
                    : item.ref.catalog === "ingredient",
              );
              const options = [
                {
                  id: "none",
                  name: t("inventory.catalogNone"),
                  ref: null as CatalogReference | null,
                },
                ...allowed.map((item) => ({
                  id: referenceKey(item.ref),
                  name: item.name,
                  ref: item.ref,
                })),
              ];
              const rowName = row.stockInput?.name || row.sourceName;
              const duplicate =
                Boolean(rowName) &&
                (reviewed.some(
                  (other) =>
                    other.rowNumber !== row.rowNumber &&
                    (other.stockInput?.name || other.sourceName) === rowName,
                ) ||
                  stockAtOpen.some(
                    (old) => old.name === rowName && !row.stockId,
                  ));
              return (
                <div
                  key={row.rowNumber}
                  className="space-y-3 rounded-lg border p-3"
                >
                  <Label className="flex items-center gap-2">
                    <Checkbox
                      disabled={busy}
                      checked={!row.skip}
                      onCheckedChange={(checked) =>
                        setExcluded((old) => ({
                          ...old,
                          [row.rowNumber]: !checked,
                        }))
                      }
                    />
                    {t("inventory.transfer.row", { row: row.rowNumber })}:{" "}
                    {row.stockInput?.name ||
                      row.sourceName ||
                      t("inventory.transfer.invalidRow")}
                  </Label>
                  {row.stockInput ? (
                    <p className="text-sm">
                      {row.existing && mode === "update"
                        ? `${number(row.existing.quantity.value)} → `
                        : ""}
                      {number(row.stockInput.quantity.value)}{" "}
                      {t(`inventory.units.${row.stockInput.quantity.unit}`)} ·{" "}
                      {t(`inventory.categories.${row.stockInput.category}`)}
                    </p>
                  ) : null}
                  {row.stockInput?.notes ? (
                    <p className="whitespace-pre-wrap break-words text-xs text-muted-foreground">
                      {row.stockInput.notes}
                    </p>
                  ) : null}
                  {row.stockId && mode === "create" ? (
                    <p className="text-sm text-muted-foreground">
                      {t(
                        row.existing
                          ? "inventory.transfer.existingSkipped"
                          : "inventory.transfer.restoredStock",
                      )}
                    </p>
                  ) : null}
                  {duplicate ? (
                    <p className="text-sm text-muted-foreground">
                      {t("inventory.transfer.duplicate")}
                    </p>
                  ) : null}
                  {row.errors.length ? (
                    <p role="alert" className="text-sm text-destructive">
                      {row.errors
                        .map((error) =>
                          t(
                            `inventory.transfer.rowErrors.${error}`,
                            t("inventory.transfer.rowErrors.row"),
                          ),
                        )
                        .join(" ")}
                    </p>
                  ) : null}
                  {row.stockInput?.category !== "packaging" &&
                  row.stockInput ? (
                    <div className="space-y-2">
                      <Label htmlFor={`${id}-catalog-${row.rowNumber}`}>
                        {t("inventory.catalogLink")}
                      </Label>
                      <SearchableInput
                        id={`${id}-catalog-${row.rowNumber}`}
                        disabled={busy || row.skip}
                        items={options}
                        keyName="name"
                        getValue={getValue}
                        query={
                          queries[row.rowNumber] ??
                          (ref ? referenceKey(ref) : "none")
                        }
                        setQuery={(query) => {
                          setQueries((old) => ({
                            ...old,
                            [row.rowNumber]: query,
                          }));
                          setReferences((old) => ({
                            ...old,
                            [row.rowNumber]: null,
                          }));
                        }}
                        onSelect={(item) => {
                          setQueries((old) => ({
                            ...old,
                            [row.rowNumber]: item.id,
                          }));
                          setReferences((old) => ({
                            ...old,
                            [row.rowNumber]: item.ref,
                          }));
                        }}
                      />
                      {row.suggestion.warning &&
                      overrides[row.rowNumber] === undefined ? (
                        <p className="text-xs text-muted-foreground">
                          {t("inventory.transfer.matchWarning")}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button
                variant="outline"
                disabled={!page || busy}
                onClick={() => setPage(page - 1)}
              >
                {t("inventory.transfer.previous")}
              </Button>
              <span className="text-sm">
                {t("inventory.transfer.page", {
                  page: page + 1,
                  total: Math.max(1, Math.ceil(reviewed.length / 25)),
                })}
              </span>
              <Button
                variant="outline"
                disabled={(page + 1) * 25 >= reviewed.length || busy}
                onClick={() => setPage(page + 1)}
              >
                {t("inventory.transfer.next")}
              </Button>
            </div>
            {reviewed.some((row) => row.errors.length) ? (
              <Button variant="outline" onClick={errorReport}>
                {t("inventory.transfer.errorReport")}
              </Button>
            ) : null}
          </div>
        ) : null}
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <DialogFooter className="gap-2">
          <Button variant="outline" disabled={busy} onClick={onClose}>
            {t("equipment.cancel")}
          </Button>
          {step !== "file" ? (
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => nextStep(step === "review" ? "map" : "file")}
            >
              {t("inventory.transfer.back")}
            </Button>
          ) : null}
          {step === "file" ? (
            <LoadingButton
              loading={busy}
              disabled={!file}
              onClick={() => void inspect()}
            >
              {t("inventory.transfer.readFile")}
            </LoadingButton>
          ) : step === "map" ? (
            <Button
              disabled={
                mapping.name === undefined || mapping.quantity === undefined
              }
              onClick={() => {
                setPage(0);
                nextStep("review");
              }}
            >
              {t("inventory.transfer.review")}
            </Button>
          ) : (
            <LoadingButton
              loading={busy}
              disabled={!ready}
              onClick={() => void save()}
            >
              {t("inventory.transfer.confirm", { count: selected.length })}
            </LoadingButton>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

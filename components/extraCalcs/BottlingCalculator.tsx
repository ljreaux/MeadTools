"use client";

import * as React from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput
} from "@/components/ui/input-group";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import {
  isValidNumber,
  normalizeNumberString,
  parseNumber
} from "@/lib/utils/validateInput";

export const L_PER_GAL = 3.78541;
export const FL_OZ_PER_L = 33.814;

export const BOTTLE_SIZES_L: Record<string, number> = {
  "12oz": 0.355,
  "187ml": 0.187,
  "330ml": 0.33,
  "375ml": 0.375,
  "500ml": 0.5,
  "22oz": 0.65,
  "750ml": 0.75,
  "1L": 1,
  "1.5L": 1.5,
  "3L": 3,
  "5gal": 18.9271,
  "Oxebar 20L": 20,
  "Oxebar 8L": 8,
  "Oxebar 4L": 4
};

export type BottleSizeKey = keyof typeof BOTTLE_SIZES_L | "custom";
export type CustomUnit = "fl_oz" | "ml" | "liter" | "gallon";
export type BottlingVolumeUnit = "gallons" | "liters";

export type BottleRow = {
  size: BottleSizeKey;
  quantity: string;
  id: string;
  totalVolumeL: number;
  customSizeValue: string;
  customSizeUnits: CustomUnit;
};

export type PackagingBottleRow = {
  label: string;
  quantity: number;
  sizeLiters: number;
  totalLiters: number;
  customSizeValue?: number;
  customSizeUnits?: CustomUnit;
};

function safeFloat(s: string | undefined) {
  if (!s || !isValidNumber(s)) return 0;
  const n = parseNumber(s);
  return Number.isFinite(n) ? n : 0;
}

function formatInputNumber(value: number) {
  if (!Number.isFinite(value)) return "";
  return String(Number(value.toFixed(3)));
}

export function toLiters(value: string | number, unit: CustomUnit) {
  const n = typeof value === "number" ? value : safeFloat(value);
  if (unit === "liter") return n;
  if (unit === "ml") return n / 1000;
  if (unit === "gallon") return n * L_PER_GAL;
  return n / FL_OZ_PER_L;
}

function createInitialBottleRows(): BottleRow[] {
  return Object.keys(BOTTLE_SIZES_L).map((size, idx) => ({
    size: size as BottleSizeKey,
    quantity: "",
    id: idx.toString(),
    totalVolumeL: 0,
    customSizeValue: "",
    customSizeUnits: "liter"
  }));
}

function bottleRowFromPackaging(row: PackagingBottleRow, idx: number): BottleRow {
  const matchingSize = Object.entries(BOTTLE_SIZES_L).find(
    ([label, liters]) =>
      label === row.label ||
      Math.abs(liters - row.sizeLiters) < 0.0005
  )?.[0] as BottleSizeKey | undefined;

  const size = matchingSize ?? "custom";
  const quantity = Number.isFinite(row.quantity) ? String(row.quantity) : "";
  const sizeLiters = Number.isFinite(row.sizeLiters) ? row.sizeLiters : 0;

  return {
    size,
    quantity,
    id: `saved-${idx}-${row.label}`,
    totalVolumeL: sizeLiters * safeFloat(quantity),
    customSizeValue: size === "custom" ? formatInputNumber(sizeLiters) : "",
    customSizeUnits: "liter"
  };
}

export function useBottlingRows(defaultTotalVolume = "5") {
  const [totalVolume, setTotalVolume] = React.useState(defaultTotalVolume);
  const [volumeUnits, setVolumeUnits] =
    React.useState<BottlingVolumeUnit>("gallons");

  const [bottleRows, setBottleRows] =
    React.useState<BottleRow[]>(createInitialBottleRows);

  const perBottleLiters = React.useCallback((row: BottleRow) => {
    return row.size === "custom"
      ? toLiters(row.customSizeValue, row.customSizeUnits)
      : BOTTLE_SIZES_L[row.size];
  }, []);

  const calculateTotalL = React.useCallback(
    (row: BottleRow, quantity: string) => perBottleLiters(row) * safeFloat(quantity),
    [perBottleLiters]
  );

  const updateBottleRow = (id: string, value: string) => {
    if (value !== "" && !isValidNumber(value)) return;
    setBottleRows((prev) =>
      prev.map((row) =>
        row.id === id
          ? {
              ...row,
              quantity: value,
              totalVolumeL: calculateTotalL(row, value)
            }
          : row
      )
    );
  };

  const updateCustomRow = (
    id: string,
    patch: Partial<Pick<BottleRow, "customSizeValue" | "customSizeUnits">>
  ) => {
    if (
      patch.customSizeValue !== undefined &&
      patch.customSizeValue !== "" &&
      !isValidNumber(patch.customSizeValue)
    ) {
      return;
    }

    setBottleRows((prev) =>
      prev.map((row) =>
        row.id === id
          ? {
              ...row,
              ...patch,
              totalVolumeL: calculateTotalL({ ...row, ...patch }, row.quantity)
            }
          : row
      )
    );
  };

  const addCustomRow = () =>
    setBottleRows((prev) => [
      ...prev,
      {
        size: "custom",
        quantity: "",
        id: `custom-${Date.now()}`,
        totalVolumeL: 0,
        customSizeValue: "",
        customSizeUnits: "liter"
      }
    ]);

  const removeRow = (id: string) =>
    setBottleRows((prev) => prev.filter((r) => r.id !== id));

  const loadPackagingRows = React.useCallback((rows: PackagingBottleRow[]) => {
    const savedRows = rows.map(bottleRowFromPackaging);
    const savedLabels = new Set(savedRows.map((row) => row.size));
    const emptyRows = createInitialBottleRows().filter(
      (row) => !savedLabels.has(row.size)
    );
    setBottleRows([...savedRows, ...emptyRows]);
  }, []);

  const totalVolumeBottledL = bottleRows.reduce(
    (sum, row) => sum + row.totalVolumeL,
    0
  );

  const totalTargetVolumeL =
    volumeUnits === "gallons"
      ? safeFloat(totalVolume) * L_PER_GAL
      : safeFloat(totalVolume);

  const remainingVolumeL = totalTargetVolumeL - totalVolumeBottledL;

  const fillRowToTarget = (id: string) => {
    setBottleRows((prev) => {
      const row = prev.find((r) => r.id === id);
      if (!row) return prev;

      const perBottleL = perBottleLiters(row);
      if (!Number.isFinite(perBottleL) || perBottleL <= 0) return prev;

      const bottledExcludingRow =
        prev.reduce((sum, r) => sum + r.totalVolumeL, 0) - row.totalVolumeL;

      const neededL = totalTargetVolumeL - bottledExcludingRow;
      if (neededL <= 0) {
        return prev.map((r) =>
          r.id === id ? { ...r, quantity: "0", totalVolumeL: 0 } : r
        );
      }

      const qty = Math.ceil(neededL / perBottleL);

      return prev.map((r) =>
        r.id === id
          ? {
              ...r,
              quantity: String(qty),
              totalVolumeL: perBottleL * qty
            }
          : r
      );
    });
  };

  const handleVolumeUnitsChange = (u: string) => {
    const nextUnit = u as BottlingVolumeUnit;
    if (nextUnit === volumeUnits) return;

    if (totalVolume.trim() === "") {
      setVolumeUnits(nextUnit);
      return;
    }

    const currentLiters = totalTargetVolumeL;
    const nextValue =
      nextUnit === "gallons" ? currentLiters / L_PER_GAL : currentLiters;

    setVolumeUnits(nextUnit);
    setTotalVolume(formatInputNumber(nextValue));
  };

  return {
    totalVolume,
    volumeUnits,
    handleTotalVolumeChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.value === "" || isValidNumber(e.target.value)) {
        setTotalVolume(e.target.value);
      }
    },
    handleVolumeUnitsChange,
    setTotalVolume,
    setVolumeUnits,
    setBottleRows,
    loadPackagingRows,
    bottleRows,
    updateBottleRow,
    addCustomRow,
    updateCustomRow,
    removeRow,
    totalVolumeBottledL,
    remainingVolumeL,
    totalTargetVolumeL,
    getPerBottleLiters: perBottleLiters,
    fillRowToTarget
  };
}

export type BottlingRowsState = ReturnType<typeof useBottlingRows>;

export function getPackagingBottleRows(
  bottleRows: BottleRow[],
  getPerBottleLiters: (row: BottleRow) => number
): PackagingBottleRow[] {
  return bottleRows
    .map((row): PackagingBottleRow | null => {
      const quantity = safeFloat(row.quantity);
      const sizeLiters = getPerBottleLiters(row);
      if (!Number.isFinite(quantity) || quantity <= 0) return null;
      if (!Number.isFinite(sizeLiters) || sizeLiters <= 0) return null;

      return {
        label: row.size === "custom" ? "Custom" : row.size,
        quantity,
        sizeLiters,
        totalLiters: row.totalVolumeL,
        customSizeValue:
          row.size === "custom" ? safeFloat(row.customSizeValue) : undefined,
        customSizeUnits:
          row.size === "custom" ? row.customSizeUnits : undefined
      };
    })
    .filter((row): row is PackagingBottleRow => Boolean(row));
}

export function BottlingCalculator({
  state,
  showTitle = false,
  compact = false
}: {
  state: BottlingRowsState;
  showTitle?: boolean;
  compact?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage;

  const unitShort =
    state.volumeUnits === "gallons"
      ? t("bottlingCalculator.units.galShort")
      : t("bottlingCalculator.units.lShort");

  const totalVolumeInLiters =
    state.volumeUnits === "liters"
      ? safeFloat(state.totalVolume)
      : safeFloat(state.totalVolume) * L_PER_GAL;

  const totalBottledDisplay =
    state.volumeUnits === "gallons"
      ? state.totalVolumeBottledL / L_PER_GAL
      : state.totalVolumeBottledL;

  const remainingDisplay =
    state.volumeUnits === "gallons"
      ? state.remainingVolumeL / L_PER_GAL
      : state.remainingVolumeL;

  const threshold = 0.1;

  const status = React.useMemo(() => {
    if (Math.abs(remainingDisplay) <= threshold) return "ok" as const;
    if (remainingDisplay > 0) return "warn" as const;
    return "error" as const;
  }, [remainingDisplay]);

  const statusCopy =
    status === "ok"
      ? {
          title: t("bottlingCalculator.status.ok.title"),
          body: t("bottlingCalculator.status.ok.body")
        }
      : status === "warn"
        ? {
            title: t("bottlingCalculator.status.warn.title"),
            body: t("bottlingCalculator.status.warn.body")
          }
        : {
            title: t("bottlingCalculator.status.error.title"),
            body: t("bottlingCalculator.status.error.body")
          };

  const statusClasses =
    status === "ok"
      ? "bg-background text-foreground border-foreground/20"
      : status === "warn"
        ? "bg-warning text-foreground border-foreground/20"
        : "bg-destructive text-destructive-foreground border-destructive/40";

  const numberCellClass = "tabular-nums whitespace-nowrap";

  return (
    <div className={compact ? "flex flex-col gap-4" : "flex flex-col gap-8 h-full w-full max-w-3xl mx-auto"}>
      {showTitle ? (
        <h1 className="sm:text-3xl text-xl text-center">
          {t("bottlingCalculator.title")}
        </h1>
      ) : null}

      <div className="space-y-2">
        <label htmlFor="totalVolume" className="text-sm font-medium">
          {t("bottlingCalculator.totalVolumeLabel")}
        </label>

        <InputGroup className="h-12">
          <InputGroupInput
            id="totalVolume"
            inputMode="decimal"
            value={state.totalVolume}
            onFocus={(e) => e.target.select()}
            onChange={state.handleTotalVolumeChange}
            className="h-full text-lg"
          />

          <InputGroupAddon
            align="inline-end"
            className="px-1 text-xs sm:text-sm whitespace-nowrap"
          >
            <Separator orientation="vertical" className="h-12" />
            <Select
              value={state.volumeUnits}
              onValueChange={state.handleVolumeUnitsChange}
            >
              <SelectTrigger className="p-2 border-none mr-2 w-20">
                <SelectValue
                  placeholder={t("bottlingCalculator.volumeUnits.placeholder")}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gallons">
                  {t("bottlingCalculator.volumeUnits.gallons")}
                </SelectItem>
                <SelectItem value="liters">
                  {t("bottlingCalculator.volumeUnits.liters")}
                </SelectItem>
              </SelectContent>
            </Select>
          </InputGroupAddon>
        </InputGroup>
      </div>

      {!compact ? <Separator /> : null}

      <div className={`rounded-md border px-4 py-3 ${statusClasses}`}>
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium">{statusCopy.title}</p>
          <p className="text-sm opacity-90">{statusCopy.body}</p>

          {status !== "ok" ? (
            <p className={`text-sm opacity-90 ${numberCellClass}`}>
              {status === "warn"
                ? `${t("bottlingCalculator.status.warn.remainingPrefix")} `
                : `${t("bottlingCalculator.status.error.overByPrefix")} `}
              {normalizeNumberString(Math.abs(remainingDisplay), 2, locale)}{" "}
              <span className="text-muted-foreground">{unitShort}</span>
            </p>
          ) : (
            <p className={`text-sm opacity-90 ${numberCellClass}`}>
              {t("bottlingCalculator.status.withinPrefix")} {threshold}{" "}
              <span className="text-muted-foreground">{unitShort}</span>
            </p>
          )}
        </div>
      </div>

      <div className="rounded-md border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("bottlingCalculator.table.bottle")}</TableHead>
              <TableHead>{t("bottlingCalculator.table.qty")}</TableHead>
              <TableHead>{t("bottlingCalculator.table.total")}</TableHead>
              {!compact ? (
                <TableHead>
                  {t("bottlingCalculator.table.percentOfBatch")}
                </TableHead>
              ) : null}
              <TableHead>
                {t("bottlingCalculator.table.remainingBottles")}
              </TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>

          <TableBody>
            {state.bottleRows.map((row) => {
              const totalBottleVolume =
                state.volumeUnits === "gallons"
                  ? row.totalVolumeL * FL_OZ_PER_L
                  : row.totalVolumeL;

              const percentOfTotal =
                totalVolumeInLiters > 0
                  ? (row.totalVolumeL / totalVolumeInLiters) * 100
                  : 0;

              const totalUnitLabel =
                state.volumeUnits === "gallons"
                  ? t("bottlingCalculator.units.flOzShort")
                  : t("bottlingCalculator.units.lShort");
              const perBottleL = state.getPerBottleLiters(row);

              const bottledExcludingRow =
                state.totalVolumeBottledL - row.totalVolumeL;
              const neededL = state.totalTargetVolumeL - bottledExcludingRow;

              const remainingBottles =
                perBottleL > 0 && neededL > 0
                  ? Math.ceil(neededL / perBottleL)
                  : 0;
              return (
                <TableRow key={row.id}>
                  <TableCell>
                    {row.size !== "custom" && <p>{row.size}</p>}

                    {row.size === "custom" && (
                      <InputGroup className="h-12">
                        <InputGroupInput
                          inputMode="decimal"
                          value={row.customSizeValue}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) =>
                            state.updateCustomRow(row.id, {
                              customSizeValue: e.target.value
                            })
                          }
                          className="h-full text-lg min-w-24"
                          placeholder={t(
                            "bottlingCalculator.custom.sizePlaceholder"
                          )}
                        />
                        <InputGroupAddon
                          align="inline-end"
                          className="px-1 text-xs sm:text-sm whitespace-nowrap"
                        >
                          <Separator orientation="vertical" className="h-12" />
                          <Select
                            value={row.customSizeUnits}
                            onValueChange={(v) =>
                              state.updateCustomRow(row.id, {
                                customSizeUnits: v as CustomUnit
                              })
                            }
                          >
                            <SelectTrigger className="p-2 border-none mr-2 w-12 sm:w-20">
                              <SelectValue
                                placeholder={t(
                                  "bottlingCalculator.custom.units.placeholder"
                                )}
                              />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="ml">
                                {t("bottlingCalculator.custom.units.ml", "mL")}
                              </SelectItem>
                              <SelectItem value="fl_oz">
                                {t("bottlingCalculator.custom.units.flOz")}
                              </SelectItem>
                              <SelectItem value="liter">
                                {t("bottlingCalculator.custom.units.liter")}
                              </SelectItem>
                              <SelectItem value="gallon">
                                {t("bottlingCalculator.custom.units.gallon")}
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </InputGroupAddon>
                      </InputGroup>
                    )}
                  </TableCell>

                  <TableCell>
                    <InputGroup className="h-12">
                      <InputGroupInput
                        inputMode="decimal"
                        value={row.quantity}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) =>
                          state.updateBottleRow(row.id, e.target.value)
                        }
                        className="h-full text-lg w-24"
                      />
                    </InputGroup>
                  </TableCell>

                  <TableCell className={`${numberCellClass} w-[7.5rem]`}>
                    {normalizeNumberString(totalBottleVolume, 1, locale)}{" "}
                    <span className="text-muted-foreground">
                      {totalUnitLabel}
                    </span>
                  </TableCell>

                  {!compact ? (
                    <TableCell className={`${numberCellClass} w-[6.5rem]`}>
                      {normalizeNumberString(percentOfTotal, 1, locale)}%
                    </TableCell>
                  ) : null}
                  <TableCell className={`${numberCellClass} w-[10rem]`}>
                    <div className="flex items-center gap-2 justify-between">
                      <span>
                        {normalizeNumberString(remainingBottles, 0, locale)}
                      </span>

                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={
                          remainingBottles <= 0 ||
                          !Number.isFinite(perBottleL) ||
                          perBottleL <= 0
                        }
                        onClick={() => state.fillRowToTarget(row.id)}
                      >
                        {t("bottlingCalculator.table.addBottles")}
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell>
                    {row.size === "custom" && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-label={t(
                          "bottlingCalculator.table.removeCustomBottleAria"
                        )}
                        onClick={() => state.removeRow(row.id)}
                      >
                        {t("bottlingCalculator.custom.remove")}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Button type="button" variant="secondary" onClick={state.addCustomRow}>
        {t("bottlingCalculator.custom.add")}
      </Button>

      <div className="flex items-center w-full p-2">
        <div className="flex-1 flex justify-end">
          <div className="text-center mr-3">
            <p className="sm:text-2xl text-lg font-semibold tabular-nums">
              {normalizeNumberString(totalBottledDisplay, 2, locale)}{" "}
              <span className="text-muted-foreground">{unitShort}</span>
            </p>
            <p className="text-xs uppercase text-muted-foreground">
              {t("bottlingCalculator.results.totalVolumeBottled")}
            </p>
          </div>
        </div>

        <Separator orientation="vertical" className="h-8" />

        <div className="flex-1 flex justify-start">
          <div className="text-center ml-3">
            <p className="sm:text-2xl text-lg font-semibold tabular-nums">
              {normalizeNumberString(Math.abs(remainingDisplay), 2, locale)}{" "}
              <span className="text-muted-foreground">{unitShort}</span>
            </p>
            <p className="text-xs uppercase text-muted-foreground">
              {status === "error"
                ? t("bottlingCalculator.results.overBy")
                : t("bottlingCalculator.results.unbottledVolume")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

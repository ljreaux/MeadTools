"use client";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput
} from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  isValidNumber,
  normalizeNumberString
} from "@/lib/utils/validateInput";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

const L_PER_GAL = 3.78541;
const FL_OZ_PER_L = 33.814;

export default function Bottling() {
  const {
    totalVolume,
    handleTotalVolumeChange,
    volumeUnits,
    handleVolumeUnitsChange,
    bottleRows,
    updateBottleRow,
    addCustomRow,
    updateCustomRow,
    removeRow,
    totalVolumeBottledL,
    remainingVolumeL
  } = useBottles();

  const { i18n } = useTranslation();
  const locale = i18n.resolvedLanguage;

  const unitShort = volumeUnits === "gallons" ? "gal" : "L";

  const totalVolumeInLiters =
    volumeUnits === "liters"
      ? safeFloat(totalVolume)
      : safeFloat(totalVolume) * L_PER_GAL;

  const totalBottledDisplay =
    volumeUnits === "gallons"
      ? totalVolumeBottledL / L_PER_GAL
      : totalVolumeBottledL;

  const remainingDisplay =
    volumeUnits === "gallons" ? remainingVolumeL / L_PER_GAL : remainingVolumeL;

  const threshold = 0.1;

  const status = useMemo(() => {
    if (Math.abs(remainingDisplay) <= threshold) return "ok" as const;
    if (remainingDisplay > 0) return "warn" as const;
    return "error" as const;
  }, [remainingDisplay]);

  const statusCopy =
    status === "ok"
      ? { title: "All accounted for", body: "Bottled volume matches batch." }
      : status === "warn"
        ? {
            title: "Unbottled volume remaining",
            body: "You still have volume not assigned to bottles."
          }
        : {
            title: "Overfilled",
            body: "Your bottle totals exceed the batch size."
          };

  const statusClasses =
    status === "ok"
      ? "bg-background text-foreground border-foreground/20"
      : status === "warn"
        ? "bg-warning text-foreground border-foreground/20"
        : "bg-destructive text-destructive-foreground border-destructive/40";

  const numberCellClass = "tabular-nums whitespace-nowrap";

  return (
    <div className="flex flex-col gap-8 h-full w-full max-w-3xl mx-auto">
      <h1 className="sm:text-3xl text-xl text-center">Bottling Calculator</h1>

      {/* Total volume */}
      <div className="space-y-2">
        <label htmlFor="totalVolume" className="text-sm font-medium">
          Total volume
        </label>

        <InputGroup className="h-12">
          <InputGroupInput
            id="totalVolume"
            inputMode="decimal"
            value={totalVolume}
            onFocus={(e) => e.target.select()}
            onChange={handleTotalVolumeChange}
            className="h-full text-lg"
          />

          <InputGroupAddon
            align="inline-end"
            className="px-1 text-xs sm:text-sm whitespace-nowrap"
          >
            <Separator orientation="vertical" className="h-12" />
            <Select value={volumeUnits} onValueChange={handleVolumeUnitsChange}>
              <SelectTrigger className="p-2 border-none mr-2 w-20">
                <SelectValue placeholder={"Gallons"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gallons">Gallons</SelectItem>
                <SelectItem value="liters">Liters</SelectItem>
              </SelectContent>
            </Select>
          </InputGroupAddon>
        </InputGroup>
      </div>

      <Separator />

      {/* Status */}
      <div className={`rounded-md border px-4 py-3 ${statusClasses}`}>
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium">{statusCopy.title}</p>
          <p className="text-sm opacity-90">{statusCopy.body}</p>

          {status !== "ok" ? (
            <p className={`text-sm opacity-90 ${numberCellClass}`}>
              {status === "warn" ? "Remaining: " : "Over by: "}
              {normalizeNumberString(
                Math.abs(remainingDisplay),
                2,
                locale
              )}{" "}
              <span className="text-muted-foreground">{unitShort}</span>
            </p>
          ) : (
            <p className={`text-sm opacity-90 ${numberCellClass}`}>
              Within {threshold}{" "}
              <span className="text-muted-foreground">{unitShort}</span>
            </p>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Bottle</TableHead>
              <TableHead>Qty</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>% of batch</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>

          <TableBody>
            {bottleRows.map((row) => {
              const totalBottleVolume =
                volumeUnits === "gallons"
                  ? row.totalVolumeL * FL_OZ_PER_L
                  : row.totalVolumeL;

              const percentOfTotal =
                totalVolumeInLiters > 0
                  ? (row.totalVolumeL / totalVolumeInLiters) * 100
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
                            updateCustomRow(row.id, {
                              customSizeValue: e.target.value
                            })
                          }
                          className="h-full text-lg min-w-24"
                          placeholder="Bottle size"
                        />
                        <InputGroupAddon
                          align="inline-end"
                          className="px-1 text-xs sm:text-sm whitespace-nowrap"
                        >
                          <Separator orientation="vertical" className="h-12" />
                          <Select
                            value={row.customSizeUnits}
                            onValueChange={(v) =>
                              updateCustomRow(row.id, {
                                customSizeUnits: v as CustomUnit
                              })
                            }
                          >
                            <SelectTrigger className="p-2 border-none mr-2 w-12 sm:w-20">
                              <SelectValue placeholder={"L"} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="fl_oz">fl oz</SelectItem>
                              <SelectItem value="liter">L</SelectItem>
                              <SelectItem value="gallon">gallons</SelectItem>
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
                          updateBottleRow(row.id, e.target.value)
                        }
                        className="h-full text-lg w-24"
                      />
                    </InputGroup>
                  </TableCell>

                  <TableCell className={`${numberCellClass} w-[7.5rem]`}>
                    {normalizeNumberString(totalBottleVolume, 1, locale)}{" "}
                    <span className="text-muted-foreground">
                      {volumeUnits === "gallons" ? "fl oz" : "L"}
                    </span>
                  </TableCell>

                  <TableCell className={`${numberCellClass} w-[6.5rem]`}>
                    {normalizeNumberString(percentOfTotal, 1, locale)}%
                  </TableCell>

                  <TableCell>
                    {row.size === "custom" && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-label="Remove custom bottle"
                        onClick={() => removeRow(row.id)}
                      >
                        Remove
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Button type="button" variant="secondary" onClick={addCustomRow}>
        Add custom bottle
      </Button>

      {/* Results */}
      <div className="flex items-center w-full p-2">
        <div className="flex-1 flex justify-end">
          <div className="text-center mr-3">
            <p className="sm:text-2xl text-lg font-semibold tabular-nums">
              {normalizeNumberString(totalBottledDisplay, 2, locale)}{" "}
              <span className="text-muted-foreground">{unitShort}</span>
            </p>
            <p className="text-xs uppercase text-muted-foreground">
              Total volume bottled
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
              {status === "error" ? "Over by" : "Unbottled volume"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function safeFloat(s: string | undefined) {
  if (!s || !isValidNumber(s)) return 0;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

const BOTTLE_SIZES_L: Record<string, number> = {
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

type BottleSizeKey = keyof typeof BOTTLE_SIZES_L | "custom";
type CustomUnit = "fl_oz" | "liter" | "gallon";

type BottleRow = {
  size: BottleSizeKey;
  quantity: string;
  id: string;
  totalVolumeL: number;
  customSizeValue: string;
  customSizeUnits: CustomUnit;
};

function useBottles() {
  const [totalVolume, setTotalVolume] = useState("5");
  const [volumeUnits, setVolumeUnits] = useState<"gallons" | "liters">(
    "gallons"
  );

  const [bottleRows, setBottleRows] = useState<BottleRow[]>(
    Object.keys(BOTTLE_SIZES_L).map((size, idx) => ({
      size: size as BottleSizeKey,
      quantity: "",
      id: idx.toString(),
      totalVolumeL: 0,
      customSizeValue: "",
      customSizeUnits: "liter"
    }))
  );

  const toLiters = (value: string, unit: CustomUnit) => {
    const n = safeFloat(value);
    if (unit === "liter") return n;
    if (unit === "gallon") return n * L_PER_GAL;
    return n / FL_OZ_PER_L;
  };

  const perBottleLiters = (row: BottleRow) =>
    row.size === "custom"
      ? toLiters(row.customSizeValue, row.customSizeUnits)
      : BOTTLE_SIZES_L[row.size];

  const calculateTotalL = (row: BottleRow, quantity: string) =>
    perBottleLiters(row) * safeFloat(quantity);

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
    )
      return;

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

  const totalVolumeBottledL = bottleRows.reduce(
    (sum, row) => sum + row.totalVolumeL,
    0
  );

  const remainingVolumeL =
    volumeUnits === "gallons"
      ? safeFloat(totalVolume) * L_PER_GAL - totalVolumeBottledL
      : safeFloat(totalVolume) - totalVolumeBottledL;

  return {
    totalVolume,
    volumeUnits,
    handleTotalVolumeChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      isValidNumber(e.target.value) && setTotalVolume(e.target.value),
    handleVolumeUnitsChange: (u: string) =>
      setVolumeUnits(u as "gallons" | "liters"),
    bottleRows,
    updateBottleRow,
    addCustomRow,
    updateCustomRow,
    removeRow,
    totalVolumeBottledL,
    remainingVolumeL
  };
}

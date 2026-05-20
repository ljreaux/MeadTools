"use client";

import type React from "react";
import type { TFunction } from "i18next";

import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group";
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  KG_TO_WEIGHT,
  L_TO_VOLUME,
  VOLUME_TO_L,
  WEIGHT_TO_KG
} from "@/lib/utils/recipeDataCalculations";
import { parseNumber } from "@/lib/utils/validateInput";
import type { IngredientLine, VolumeUnit, WeightUnit } from "@/types/recipeData";

export type AdditionBasis = "weight" | "volume" | "other";

const ingredientWeightUnits: WeightUnit[] = ["kg", "g", "lb", "oz"];
const ingredientVolumeUnits: VolumeUnit[] = ["L", "mL", "gal", "qt", "pt", "fl_oz", "imp_gal", "imp_qt", "imp_pt", "imp_fl_oz"];
const additiveWeightUnits = ["g", "mg", "kg", "oz", "lbs"];
const additiveVolumeUnits = ["ml", "liters", "fl_oz", "quarts", "gal", "tsp", "tbsp"];
const additiveCountUnits = ["units"];

function fmtNumber(value?: number | null, decimals = 2) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return value.toFixed(decimals).replace(/\.?0+$/, "");
}

export function convertIngredientAmount(amountStr: string, fromUnit: string, toUnit: string, basis: AdditionBasis) {
  const amount = parseNumber(amountStr);
  if (!Number.isFinite(amount)) return amountStr;

  if (basis === "weight" && fromUnit in WEIGHT_TO_KG && toUnit in KG_TO_WEIGHT) {
    return fmtNumber(amount * WEIGHT_TO_KG[fromUnit as WeightUnit] * KG_TO_WEIGHT[toUnit as WeightUnit], 3);
  }

  if (basis === "volume" && fromUnit in VOLUME_TO_L && toUnit in L_TO_VOLUME) {
    return fmtNumber(amount * VOLUME_TO_L[fromUnit as VolumeUnit] * L_TO_VOLUME[toUnit as VolumeUnit], 3);
  }

  return amountStr;
}

export function getPlannedIngredientAmounts(line: IngredientLine) {
  const weightAmount = Number(line.amounts.weight.value);
  const volumeAmount = Number(line.amounts.volume.value);

  return {
    basis: line.amounts.basis as AdditionBasis,
    weightAmount: Number.isFinite(weightAmount) ? weightAmount : undefined,
    weightUnit: line.amounts.weight.unit,
    volumeAmount: Number.isFinite(volumeAmount) ? volumeAmount : undefined,
    volumeUnit: line.amounts.volume.unit
  };
}

export function IngredientBasisSelect({
  value,
  onValueChange,
  t
}: {
  value: AdditionBasis;
  onValueChange: (value: AdditionBasis) => void;
  t: TFunction;
}) {
  return (
    <Select value={value} onValueChange={(next) => onValueChange(next as AdditionBasis)}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="weight">{t("weight", "Weight")}</SelectItem>
        <SelectItem value="volume">{t("volume", "Volume")}</SelectItem>
      </SelectContent>
    </Select>
  );
}

export function IngredientUnitSelect({
  basis,
  value,
  onValueChange,
  triggerClassName
}: {
  basis: AdditionBasis;
  value: string;
  onValueChange: (value: string) => void;
  triggerClassName?: string;
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className={triggerClassName ?? "p-2 border-none mr-2 w-20"}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {(basis === "weight" ? ingredientWeightUnits : ingredientVolumeUnits).map((item) => (
          <SelectItem key={item} value={item}>
            {item}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function AmountUnitField({
  amount,
  unit,
  onAmountChange,
  unitControl,
  disabled
}: {
  amount: string;
  unit: string;
  onAmountChange: (value: string) => void;
  unitControl?: React.ReactNode;
  disabled?: boolean;
}) {
  if (!unitControl) {
    return (
      <InputGroup className="h-12">
        <InputGroupInput
          inputMode="decimal"
          value={amount}
          onChange={(event) => onAmountChange(event.target.value)}
          onFocus={(event) => event.target.select()}
          disabled={disabled}
          className="h-full text-lg"
        />
        <InputGroupAddon align="inline-end">
          <InputGroupText>{unit}</InputGroupText>
        </InputGroupAddon>
      </InputGroup>
    );
  }

  return (
    <InputGroup className="h-12">
      <InputGroupInput
        inputMode="decimal"
        value={amount}
        onChange={(event) => onAmountChange(event.target.value)}
        onFocus={(event) => event.target.select()}
        disabled={disabled}
        className="h-full text-lg"
      />
      <InputGroupAddon align="inline-end" className="px-1 text-xs sm:text-sm whitespace-nowrap mr-1">
        <Separator orientation="vertical" className="h-12" />
        {unitControl}
      </InputGroupAddon>
    </InputGroup>
  );
}

export function StaticUnitLabel({ children }: { children: React.ReactNode }) {
  return <InputGroupText>{children}</InputGroupText>;
}

export function AdditiveUnitSelect({
  value,
  onValueChange,
  triggerClassName
}: {
  value: string;
  onValueChange: (value: string) => void;
  triggerClassName?: string;
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className={triggerClassName ?? "p-2 border-none mr-2 w-16"}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {additiveWeightUnits.map((item) => (
          <SelectItem key={item} value={item}>
            {item}
          </SelectItem>
        ))}
        <SelectSeparator />
        {additiveVolumeUnits.map((item) => (
          <SelectItem key={item} value={item}>
            {item}
          </SelectItem>
        ))}
        <SelectSeparator />
        {additiveCountUnits.map((item) => (
          <SelectItem key={item} value={item}>
            {item}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

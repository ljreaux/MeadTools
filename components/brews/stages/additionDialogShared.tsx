"use client";

import * as React from "react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import lodash from "lodash";

import { Button } from "@/components/ui/button";
import { BREW_TRACKER_DIALOG_CONTENT_CLASS, BREW_TRACKER_DIALOG_FOOTER_CLASS } from "@/components/brews/brewTrackerDialog";
import { DateTimePicker } from "@/components/ui/datetime-picker";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  convertAdditiveAmount,
  inferAdditiveAmountDimFromUnit,
  KG_TO_WEIGHT,
  L_TO_VOLUME,
  nextAdditiveAmountDimOnUnitChange,
  shouldConvertAdditiveAmount,
  type UnitDim,
  VOLUME_TO_L,
  WEIGHT_TO_KG
} from "@/lib/utils/recipeDataCalculations";
import { isValidNumber, normalizeNumberString, parseNumber } from "@/lib/utils/validateInput";
import type { IngredientLine, VolumeUnit, WeightUnit } from "@/types/recipeData";

export type AdditionBasis = "weight" | "volume" | "other";
export type PlannedAdditionSource =
  | "recipe_ingredient"
  | "recipe_additive"
  | "recipe_nutrient"
  | "recipe_go_ferm"
  | "recipe_yeast"
  | "manual_yeast"
  | "manual";
export type PlannedAdditionKind = "INGREDIENT" | "NUTRIENT" | "YEAST" | "OTHER";

export type PlannedAdditionDialogItem = {
  title: string;
  name: string;
  kind: PlannedAdditionKind;
  source: PlannedAdditionSource;
  amount?: number;
  unit?: string;
  weightAmount?: number;
  weightUnit?: string;
  volumeAmount?: number;
  volumeUnit?: string;
  basis?: AdditionBasis;
  recipeIngredientId?: string;
  recipeAdditiveId?: string;
  meta?: Record<string, any>;
  components?: Array<{
    key: string;
    name: string;
    amount: number;
    unit: string;
    plannedAmount: number;
  }>;
};

type EditableAdditionComponent = {
  key: string;
  name: string;
  amount: string;
  unit: string;
  plannedAmount: number;
};

export type PlannedAdditionSaveInput = {
  name: string;
  amount?: number;
  unit?: string;
  note?: string;
  recipeIngredientId?: string;
  recipeAdditiveId?: string;
  kind?: PlannedAdditionKind;
  source?: PlannedAdditionSource;
  meta?: Record<string, any>;
  datetime?: string;
};

const ingredientWeightUnits: WeightUnit[] = ["kg", "g", "lb", "oz"];
const ingredientVolumeUnits: VolumeUnit[] = ["L", "mL", "gal", "qt", "pt", "fl_oz", "imp_gal", "imp_qt", "imp_pt", "imp_fl_oz"];
const additiveWeightUnits = ["g", "mg", "kg", "oz", "lbs"];
const additiveVolumeUnits = ["ml", "liters", "fl_oz", "quarts", "gal", "tsp", "tbsp"];
const additiveCountUnits = ["units"];

const unitTranslationKeys: Record<string, string> = {
  C: "units.C",
  F: "units.F",
  fl_oz: "FLOZ",
  g: "G",
  gal: "GALS",
  kg: "units.kg",
  L: "units.L",
  lb: "LBS",
  lbs: "LBS",
  liters: "units.L",
  mg: "units.mg",
  ml: "units.mL",
  mL: "units.mL",
  oz: "OZ",
  pt: "units.pt",
  qt: "units.qt",
  quarts: "QUARTS",
  tbsp: "TBSP",
  tsp: "TSP",
  units: "units.units"
};

const unitDisplayFallbacks: Record<string, string> = {
  C: "°C",
  F: "°F",
  fl_oz: "fl oz",
  imp_fl_oz: "imp fl oz",
  imp_gal: "imp gal",
  imp_pt: "imp pt",
  imp_qt: "imp qt",
  liters: "L",
  ml: "mL",
  quarts: "qt"
};

export function getUnitLabel(t: TFunction, unit: string) {
  const key = unitTranslationKeys[unit] ?? `units.${unit}`;
  return t(key, unitDisplayFallbacks[unit] ?? unit);
}

export function getBrewItemKey(name?: string | null) {
  const value = (name ?? "").trim();
  if (!value) return null;

  const normalized = value.toLowerCase();
  const explicitKeys: Record<string, string> = {
    "campden tablets": "campden",
    dap: "nutrients.dap",
    "fermaid k": "nutrients.fermK",
    "fermaid o": "nutrients.fermO",
    "go-ferm": "nuteResults.gfTypes.gf",
    "go-ferm protect": "nuteResults.gfTypes.gfProtect",
    "go-ferm sterol flash": "nuteResults.gfTypes.gfSterol",
    "k-meta": "kMeta",
    "na-meta": "naMeta",
    none: "none",
    other: "other.label",
    "potassium metabisulfite": "kMeta",
    "potassium sorbate": "kSorbate",
    protect: "nuteResults.gfTypes.gfProtect",
    "sodium metabisulfite": "naMeta",
    sorbate: "sorbate",
    "sterol-flash": "nuteResults.gfTypes.gfSterol"
  };

  return explicitKeys[normalized] ?? lodash.camelCase(value);
}

export function getBrewItemLabel(t: TFunction, name?: string | null) {
  const value = (name ?? "").trim();
  if (!value) return "";

  const key = getBrewItemKey(value) ?? value;
  return t(key, value);
}

function fmtNumber(value?: number | null, decimals = 2) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return normalizeNumberString(value, decimals);
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
  const { t } = useTranslation();

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className={triggerClassName ?? "p-2 border-none mr-2 w-20"}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {(basis === "weight" ? ingredientWeightUnits : ingredientVolumeUnits).map((item) => (
          <SelectItem key={item} value={item}>
            {getUnitLabel(t, item)}
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
  const { t } = useTranslation();

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className={triggerClassName ?? "p-2 border-none mr-2 w-16"}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {additiveWeightUnits.map((item) => (
          <SelectItem key={item} value={item}>
            {getUnitLabel(t, item)}
          </SelectItem>
        ))}
        <SelectSeparator />
        {additiveVolumeUnits.map((item) => (
          <SelectItem key={item} value={item}>
            {getUnitLabel(t, item)}
          </SelectItem>
        ))}
        <SelectSeparator />
        {additiveCountUnits.map((item) => (
          <SelectItem key={item} value={item}>
            {getUnitLabel(t, item)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function PlannedAdditionDialog({
  planned,
  onOpenChange,
  onSave,
  defaultTitle,
  stage,
  nutrientNotice,
  goFermOptions,
  calculateGoFermFromYeastAmount,
  includeEmptyComponents = false
}: {
  planned: PlannedAdditionDialogItem | null;
  onOpenChange: (open: boolean) => void;
  onSave: (input: PlannedAdditionSaveInput) => Promise<void>;
  defaultTitle: string;
  stage?: string;
  nutrientNotice?: string;
  goFermOptions?: ReadonlyArray<{ value: string; label: string }>;
  calculateGoFermFromYeastAmount?: (type: string, yeastAmountG?: number | null) => { amount: number; water: number } | null;
  includeEmptyComponents?: boolean;
}) {
  const { t } = useTranslation();
  const [name, setName] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [unit, setUnit] = React.useState("");
  const [basis, setBasis] = React.useState<AdditionBasis>("other");
  const [amountTouched, setAmountTouched] = React.useState(false);
  const [amountDim, setAmountDim] = React.useState<UnitDim>("unknown");
  const [note, setNote] = React.useState("");
  const [datetime, setDatetime] = React.useState<Date>(new Date());
  const [components, setComponents] = React.useState<EditableAdditionComponent[]>([]);
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    if (!planned) return;
    setName(planned.source === "recipe_go_ferm" ? planned.name : getBrewItemLabel(t, planned.name));
    setAmount(typeof planned.amount === "number" ? fmtNumber(planned.amount) : "");
    setUnit(planned.unit ?? "");
    setBasis(planned.source === "recipe_ingredient" ? (planned.basis ?? "weight") : "other");
    setAmountTouched(false);
    setAmountDim(inferAdditiveAmountDimFromUnit(planned.unit ?? ""));
    setNote("");
    setDatetime(new Date());
    setComponents(
      (planned.components ?? []).map((component) => ({
        ...component,
        amount: fmtNumber(component.amount)
      }))
    );
  }, [planned, t]);

  const usesIngredientUnits = planned?.source === "recipe_ingredient";
  const usesAdditiveUnits = planned?.source === "recipe_additive" || planned?.source === "recipe_go_ferm";
  const isGoFerm = planned?.source === "recipe_go_ferm";
  const isNutrient = planned?.source === "recipe_nutrient";

  const changeGoFermType = (nextType: string) => {
    setName(nextType);

    const recalculated = calculateGoFermFromYeastAmount?.(nextType, planned?.meta?.actualYeastAmount);
    if (!recalculated) return;

    setAmount(String(recalculated.amount));
    setAmountTouched(false);
    setAmountDim(inferAdditiveAmountDimFromUnit("g"));
  };

  const changeAmount = (value: string) => {
    if (!isValidNumber(value)) return;
    setAmount(value);
    if (usesAdditiveUnits) {
      setAmountTouched(true);
      setAmountDim(inferAdditiveAmountDimFromUnit(unit));
    }
  };

  const changeBasis = (nextBasis: AdditionBasis) => {
    setBasis(nextBasis);
    if (!planned || nextBasis === "other") return;

    if (nextBasis === "weight") {
      setAmount(typeof planned.weightAmount === "number" ? String(planned.weightAmount) : "");
      setUnit(planned.weightUnit ?? "g");
      return;
    }

    setAmount(typeof planned.volumeAmount === "number" ? String(planned.volumeAmount) : "");
    setUnit(planned.volumeUnit ?? "L");
  };

  const changeUnit = (nextUnit: string) => {
    if (usesIngredientUnits) {
      setAmount(convertIngredientAmount(amount, unit, nextUnit, basis));
      setUnit(nextUnit);
      return;
    }

    if (!usesAdditiveUnits) {
      setUnit(nextUnit);
      return;
    }

    const fromUnit = unit;
    const doConvert = shouldConvertAdditiveAmount({
      amountStr: amount,
      fromUnit,
      toUnit: nextUnit,
      amountTouched,
      amountDim
    });
    const nextAmount =
      doConvert && amount.trim().length > 0
        ? convertAdditiveAmount({
            amountStr: amount,
            fromUnit,
            toUnit: nextUnit
          })
        : amount;

    setAmount(nextAmount);
    setUnit(nextUnit);
    setAmountDim(
      nextAdditiveAmountDimOnUnitChange({
        fromUnit,
        toUnit: nextUnit,
        prevAmountDim: amountDim
      })
    );
  };

  const save = async () => {
    if (!planned) return;
    const trimmedName = name.trim();
    if (!trimmedName) return;

    const parsedAmount = amount.trim() ? parseNumber(amount) : undefined;
    const actualComponents = (components ?? []).map((component) => {
      const parsed = parseNumber(component.amount);
      return {
        ...component,
        amount: Number.isFinite(parsed) ? parsed : 0
      };
    });
    const componentTotal = actualComponents.reduce((sum, component) => {
      const value = Number(component.amount);
      return sum + (Number.isFinite(value) ? value : 0);
    }, 0);
    const actualAmount =
      actualComponents.length > 0
        ? componentTotal
        : typeof parsedAmount === "number" && Number.isFinite(parsedAmount)
          ? parsedAmount
          : undefined;

    setIsSaving(true);
    try {
      await onSave({
        name: getBrewItemLabel(t, trimmedName),
        amount: actualAmount,
        unit: unit.trim() || planned.unit,
        note: note.trim() || undefined,
        recipeIngredientId: planned.recipeIngredientId,
        recipeAdditiveId: planned.recipeAdditiveId,
        kind: planned.kind,
        source: planned.source,
        datetime: datetime.toISOString(),
        meta: {
          ...(planned.meta ?? {}),
          nameKey: planned.meta?.nameKey ?? getBrewItemKey(planned.name) ?? undefined,
          plannedName: planned.name,
          plannedAmount: planned.amount,
          plannedUnit: planned.unit,
          actualBasis: usesIngredientUnits ? basis : undefined,
          plannedBasis: planned.basis,
          plannedWeightAmount: planned.weightAmount,
          plannedWeightUnit: planned.weightUnit,
          plannedVolumeAmount: planned.volumeAmount,
          plannedVolumeUnit: planned.volumeUnit,
          actualWaterAmount:
            isGoFerm && planned.meta?.actualYeastAmount
              ? calculateGoFermFromYeastAmount?.(trimmedName, planned.meta.actualYeastAmount)?.water
              : planned.meta?.plannedWaterAmount,
          actualWaterUnit: isGoFerm ? "mL" : undefined,
          components: actualComponents.length > 0 || includeEmptyComponents ? actualComponents : undefined,
          stage: stage ?? planned.meta?.stage
        }
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={Boolean(planned)} onOpenChange={onOpenChange}>
      <DialogContent className={`${BREW_TRACKER_DIALOG_CONTENT_CLASS} sm:max-w-[560px]`}>
        <DialogHeader>
          <DialogTitle>{planned?.title ?? defaultTitle}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t("name", "Name")}</Label>
            {isGoFerm && goFermOptions?.length ? (
              <Select value={name} onValueChange={changeGoFermType}>
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {goFermOptions.map(({ value, label }) => (
                    <SelectItem key={value} value={value}>
                      {t(label)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input value={name} onChange={(event) => setName(event.target.value)} />
            )}
          </div>

          {isNutrient && nutrientNotice ? (
            <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              {nutrientNotice}
            </div>
          ) : null}

          {components?.length ? (
            <div className="space-y-2">
              <Label>{t("amounts", "Amounts")}</Label>
              <div className="space-y-2">
                {components.map((component, index) => (
                  <div key={component.key} className="grid gap-2 sm:grid-cols-[1fr_minmax(11rem,14rem)]">
                    <div className="self-center text-sm">{getBrewItemLabel(t, component.name)}</div>
                    <AmountUnitField
                      amount={String(component.amount)}
                      unit={component.unit}
                      onAmountChange={(value) => {
                        if (!isValidNumber(value)) return;
                        const next = [...components];
                        next[index] = {
                          ...component,
                          amount: value
                        };
                        setComponents(next);
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Label>{t("amount", "Amount")}</Label>
              {usesIngredientUnits ? <IngredientBasisSelect value={basis} onValueChange={changeBasis} t={t} /> : null}
              <AmountUnitField
                amount={amount}
                unit={unit}
                onAmountChange={changeAmount}
                unitControl={
                  usesIngredientUnits ? (
                    <IngredientUnitSelect basis={basis} value={unit} onValueChange={changeUnit} />
                  ) : usesAdditiveUnits ? (
                    <AdditiveUnitSelect value={unit} onValueChange={changeUnit} />
                  ) : undefined
                }
              />
            </div>
          )}

          <div className="space-y-2">
            <Label>{t("note", "Note")}</Label>
            <Textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder={t("optional", "Optional")}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>{t("date", "Date")}</Label>
            <DateTimePicker value={datetime} onChange={(value) => value && setDatetime(value)} hourCycle={12} />
          </div>
        </div>

        <DialogFooter className={BREW_TRACKER_DIALOG_FOOTER_CLASS}>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={isSaving}>
            {t("cancel", "Cancel")}
          </Button>
          <Button onClick={save} disabled={isSaving || !name.trim()}>
            {t("save", "Save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import * as React from "react";
import { useTranslation } from "react-i18next";
import lodash from "lodash";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import SearchableInput from "@/components/ui/SearchableInput";
import { useYeastsQuery } from "@/hooks/reactQuery/useYeastsQuery";
import type { BrewPlannedYeast } from "@/lib/utils/buildBrewRecipeStageData";
import type { Yeast } from "@/types/nutrientTypes";

type LogYeastInput = {
  name: string;
  amount?: number;
  unit?: string;
  note?: string;
  kind: "YEAST";
  source: "recipe_yeast" | "manual_yeast";
  meta?: Record<string, any>;
};

function yeastDisplayName(brand: string, strain: string) {
  return [brand, strain].map((part) => part.trim()).filter(Boolean).join(" ");
}

function plannedName(planned?: BrewPlannedYeast | null) {
  return planned ? yeastDisplayName(planned.brand, planned.strain) : "";
}

export function LogYeastDialog({
  open,
  onOpenChange,
  planned,
  forceManual = false,
  onSave
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planned?: BrewPlannedYeast | null;
  forceManual?: boolean;
  onSave: (input: LogYeastInput) => Promise<void>;
}) {
  const { t } = useTranslation();
  const { data: yeastList = [] } = useYeastsQuery();
  const brands = React.useMemo(() => {
    const values = new Set<string>(["Other"]);
    for (const yeast of yeastList) values.add(yeast.brand);
    if (planned?.brand) values.add(planned.brand);
    return Array.from(values).sort((a, b) => {
      if (a === planned?.brand) return -1;
      if (b === planned?.brand) return 1;
      if (a === "Other") return 1;
      if (b === "Other") return -1;
      return a.localeCompare(b);
    });
  }, [planned?.brand, yeastList]);

  const [brand, setBrand] = React.useState("Other");
  const [strain, setStrain] = React.useState("");
  const [selectedYeast, setSelectedYeast] = React.useState<Yeast | null>(null);
  const [amount, setAmount] = React.useState("");
  const [note, setNote] = React.useState("");
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;

    const plannedYeast =
      planned?.yeastId != null
        ? yeastList.find((yeast) => yeast.id === planned.yeastId) ?? null
        : yeastList.find(
            (yeast) => yeast.brand === planned?.brand && yeast.name === planned?.strain
          ) ?? null;

    setSelectedYeast(forceManual ? null : plannedYeast);
    setBrand(forceManual ? "Other" : planned?.brand || plannedYeast?.brand || "Other");
    setStrain(forceManual ? "" : planned?.strain || plannedYeast?.name || "");
    setAmount(
      !forceManual && typeof planned?.plannedAmountG === "number"
        ? String(planned.plannedAmountG)
        : ""
    );
    setNote("");
  }, [forceManual, open, planned, yeastList]);

  const sortBrandFirst = React.useCallback(
    (list: Yeast[]) =>
      [...list].sort((a, b) => {
        const aPref = a.brand === brand;
        const bPref = b.brand === brand;
        if (aPref !== bPref) return aPref ? -1 : 1;
        return a.name.localeCompare(b.name);
      }),
    [brand]
  );

  const selectYeast = (yeast: Yeast) => {
    setSelectedYeast(yeast);
    setBrand(yeast.brand);
    setStrain(yeast.name);
  };

  const actualName = yeastDisplayName(brand === "Other" ? "" : brand, strain);
  const matchesPlanned =
    !forceManual &&
    planned != null &&
    (selectedYeast?.id === planned.yeastId ||
      (brand === planned.brand && strain.trim() === planned.strain));

  const save = async () => {
    const trimmedName = actualName.trim();
    if (!trimmedName) return;

    const parsedAmount = amount.trim() ? Number(amount) : undefined;

    setIsSaving(true);
    try {
      await onSave({
        name: trimmedName,
        amount:
          typeof parsedAmount === "number" && Number.isFinite(parsedAmount)
            ? parsedAmount
            : undefined,
        unit: "g",
        note: note.trim() || undefined,
        kind: "YEAST",
        source: matchesPlanned ? "recipe_yeast" : "manual_yeast",
        meta: {
          yeastId: selectedYeast?.id ?? null,
          brand: brand === "Other" ? null : brand,
          strain: strain.trim(),
          nitrogenRequirement:
            selectedYeast?.nitrogen_requirement ?? planned?.nitrogenRequirement ?? null,
          plannedName: plannedName(planned),
          plannedAmount: planned?.plannedAmountG,
          plannedUnit: planned ? "g" : undefined,
          plannedYeastId: planned?.yeastId,
          plannedBrand: planned?.brand,
          plannedStrain: planned?.strain
        }
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{t("brews.actions.logYeast", "Log yeast")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t("yeastBrand", "Yeast brand")}</Label>
              <Select
                value={brand}
                onValueChange={(value) => {
                  setBrand(value);
                  setSelectedYeast(null);
                }}
              >
                <SelectTrigger className="h-12">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {brands.map((item) => (
                    <SelectItem key={item} value={item}>
                      {t(`${item.toLowerCase()}.label`, item)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t("yeastStrain", "Yeast strain")}</Label>
              <SearchableInput
                items={yeastList}
                query={strain}
                sortItems={sortBrandFirst}
                setQuery={(value) => {
                  setStrain(value);
                  setSelectedYeast(null);
                }}
                keyName="name"
                onSelect={selectYeast}
                renderItem={(item) => t(lodash.camelCase(item.name), item.name)}
                getLabel={(item) => t(lodash.camelCase(item.name), item.name)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t("amount", "Amount")}</Label>
            <div className="grid grid-cols-[1fr_3rem] gap-2">
              <Input
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
              <div className="self-center text-sm text-muted-foreground">g</div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t("note", "Note")}</Label>
            <Textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder={t("optional", "Optional")}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={isSaving}>
            {t("cancel", "Cancel")}
          </Button>
          <Button onClick={save} disabled={isSaving || !actualName.trim()}>
            {t("save", "Save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

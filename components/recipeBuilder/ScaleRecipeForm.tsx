"use client";

import { FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  isValidNumber,
  parseNumber,
  normalizeNumberString
} from "@/lib/utils/validateInput";

import { Button } from "@/components/ui/button";
import InputWithUnits from "@/components/nutrientCalc/InputWithUnits";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useRecipe } from "@/components/providers/RecipeProvider";

export default function ScaleRecipeForm() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;

  const {
    derived: { totalVolume, primaryVolume },
    data: { unitDefaults },
    scaleRecipe
  } = useRecipe();

  const [scaled, setScaled] = useState("0.000");
  const [scalePrimary, setScalePrimary] = useState(false);

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    scaleRecipe(parseNumber(scaled), {
      mode: scalePrimary ? "primary" : "total"
    });
  };

  const currentVolume = scalePrimary ? primaryVolume : totalVolume;

  return (
    <form
      className="joyride-scaleRecipe grid grid-cols-2 gap-2 py-6"
      onSubmit={onSubmit}
    >
      <h3 className="col-span-full">{t("scale.title")}</h3>

      {/* Current volume (output style) */}
      <label className="grid gap-1">
        {scalePrimary ? t("scale.currentPrimary") : t("scale.current")}
        <p className="text-2xl font-medium tracking-tight">
          {normalizeNumberString(currentVolume, 3, locale)}
          <span className="text-muted-foreground text-lg ml-1">
            {unitDefaults.volume}
          </span>
        </p>
      </label>

      {/* Target volume (editable) */}
      <label className="grid gap-1">
        {scalePrimary ? t("scale.targetPrimary") : t("scale.target")}
        <InputWithUnits
          value={scaled}
          handleChange={(e) => {
            if (isValidNumber(e.target.value)) setScaled(e.target.value);
          }}
          text={unitDefaults.volume}
          className="mt-auto"
        />
      </label>

      {/* Mode switch */}
      <div className="col-span-full flex items-center gap-3 pt-2">
        <Switch
          id="scale-primary"
          checked={scalePrimary}
          onCheckedChange={setScalePrimary}
        />
        <Label htmlFor="scale-primary" className="cursor-pointer">
          {scalePrimary ? t("scale.modePrimary") : t("scale.modeTotal")}
        </Label>
      </div>

      <Button
        className="col-span-full"
        variant="secondary"
        type="submit"
        disabled={totalVolume === 0 || primaryVolume === 0}
      >
        {t("scale.title")}
      </Button>
    </form>
  );
}

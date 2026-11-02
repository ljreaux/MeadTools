"use client";

import { useId } from "react";
import { useTranslation } from "react-i18next";
import { AmountUnitField } from "@/components/ui/amount-unit-field";
import { Label } from "@/components/ui/label";
import { isValidNumber, parseNumber } from "@/lib/utils/validateInput";
import { loggedYeastAmountG } from "@meadtools/brew-domain";

export function YeastPacketWeightField({
  value,
  amount,
  onChange,
}: {
  value: string;
  amount: string;
  onChange: (value: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const id = useId();
  const grams = loggedYeastAmountG({
    amount: parseNumber(amount),
    unit: "units",
    meta: { packetWeightG: parseNumber(value) },
  });
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{t("brews.yeast.packetWeight")}</Label>
      <AmountUnitField
        id={id}
        amount={value}
        unit="g"
        onAmountChange={(next) => {
          if (isValidNumber(next)) onChange(next);
        }}
      />
      <p className="text-sm text-muted-foreground">
        {t("brews.yeast.packetWeightHint")}
      </p>
      {grams != null && grams > 0 ? (
        <p className="text-sm">
          {t("brews.yeast.totalWeight", {
            amount: new Intl.NumberFormat(i18n.language, {
              maximumFractionDigits: 6,
            }).format(grams),
          })}
        </p>
      ) : null}
    </div>
  );
}

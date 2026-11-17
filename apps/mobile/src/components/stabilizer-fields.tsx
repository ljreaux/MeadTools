import { useTranslation } from "react-i18next";

import type { MetabisulfiteType, StabilizerVolumeUnit } from "@meadtools/core/extra-calculators";

import { BatchVolumeField } from "@/components/batch-volume-field";
import { CalculatorField, Segmented } from "@/components/calculator-ui";
import { convertStabilizerVolumeText } from "@/tools/calculator-input";

const METABISULFITES = ["kMeta", "naMeta"] as const satisfies readonly MetabisulfiteType[];

/** Batch size with a gal/L toggle that converts the typed volume, as on the web. */
export function StabilizerVolumeField({
  volume,
  unit,
  onVolumeChange,
  onUnitChange
}: {
  volume: string;
  unit: StabilizerVolumeUnit;
  onVolumeChange: (update: string | ((current: string) => string)) => void;
  onUnitChange: (next: StabilizerVolumeUnit) => void;
}) {
  const { t, i18n } = useTranslation();
  return (
    <BatchVolumeField
      convertText={(text, from, to) => convertStabilizerVolumeText(i18n.language, text, from, to)}
      label={t("mobileTools.inputs.batchSize")}
      onUnitChange={onUnitChange}
      onVolumeChange={onVolumeChange}
      unit={unit}
      volume={volume}
    />
  );
}

export function MetabisulfiteField({
  value,
  onChange
}: {
  value: MetabisulfiteType;
  onChange: (next: MetabisulfiteType) => void;
}) {
  const { t } = useTranslation();
  return (
    <CalculatorField label={t("mobileTools.inputs.metabisulfite")}>
      <Segmented
        label={t("mobileTools.inputs.metabisulfite")}
        onChange={onChange}
        optionLabel={(option) => t(`mobileTools.metabisulfite.${option}`)}
        options={METABISULFITES}
        value={value}
      />
    </CalculatorField>
  );
}

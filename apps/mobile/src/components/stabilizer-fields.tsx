import { useTranslation } from "react-i18next";

import type { MetabisulfiteType, StabilizerVolumeUnit } from "@meadtools/core/extra-calculators";

import { CalculatorField, DecimalInput, Grow, InputRow, Segmented } from "@/components/calculator-ui";
import { convertStabilizerVolumeText } from "@/tools/calculator-input";

const VOLUME_UNITS = ["gal", "lit"] as const satisfies readonly StabilizerVolumeUnit[];
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
    <CalculatorField label={t("mobileTools.inputs.batchSize")}>
      <InputRow>
        <Grow>
          <DecimalInput
            label={`${t("mobileTools.inputs.batchSize")}, ${t(unit === "gal" ? "units.gal" : "units.L")}`}
            onChangeText={onVolumeChange}
            value={volume}
          />
        </Grow>
        <Segmented
          label={t("mobileTools.inputs.volumeUnit")}
          onChange={(next) => {
            onVolumeChange((current) => convertStabilizerVolumeText(i18n.language, current, unit, next));
            onUnitChange(next);
          }}
          optionLabel={(option) => t(option === "gal" ? "units.gal" : "units.L")}
          options={VOLUME_UNITS}
          value={unit}
        />
      </InputRow>
    </CalculatorField>
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

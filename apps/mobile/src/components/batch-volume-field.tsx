import { useTranslation } from "react-i18next";

import { CalculatorField, DecimalInput, Grow, InputRow, Segmented } from "@/components/calculator-ui";
import { useUnitSwitch } from "@/tools/use-unit-switch";

export type BatchVolumeUnit = "gal" | "lit";
const UNITS = ["gal", "lit"] as const satisfies readonly BatchVolumeUnit[];

/**
 * A volume with a gal/L toggle. Switching units converts the typed value with
 * the calculator's own `convertText`, as each web calculator does; switching
 * straight back restores what was typed.
 */
export function BatchVolumeField({
  label,
  volume,
  unit,
  onVolumeChange,
  onUnitChange,
  convertText
}: {
  label: string;
  volume: string;
  unit: BatchVolumeUnit;
  onVolumeChange: (update: string | ((current: string) => string)) => void;
  onUnitChange: (next: BatchVolumeUnit) => void;
  convertText: (text: string, from: BatchVolumeUnit, to: BatchVolumeUnit) => string;
}) {
  const { t } = useTranslation();
  const switchUnit = useUnitSwitch<BatchVolumeUnit>();
  const unitLabel = (option: BatchVolumeUnit) => t(option === "gal" ? "units.gal" : "units.L");
  return (
    <CalculatorField label={label}>
      <InputRow>
        <Grow>
          <DecimalInput label={`${label}, ${unitLabel(unit)}`} onChangeText={onVolumeChange} value={volume} />
        </Grow>
        <Segmented
          label={t("mobileTools.inputs.volumeUnit")}
          onChange={(next) => {
            onVolumeChange(switchUnit(volume, unit, next, (text) => convertText(text, unit, next)));
            onUnitChange(next);
          }}
          optionLabel={unitLabel}
          options={UNITS}
          value={unit}
        />
      </InputRow>
    </CalculatorField>
  );
}

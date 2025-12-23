import NutrientCalculator from "@/components/nutrientCalc/NutrientCalulator";
import { NutrientProviderV2 } from "@/components/providers/NutrientProviderV2";

function NuteCalc() {
  return (
    <NutrientProviderV2 mode="standalone">
      <NutrientCalculator />
    </NutrientProviderV2>
  );
}

export default NuteCalc;

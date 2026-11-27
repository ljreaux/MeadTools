import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";

// A deep link to a calculator keeps the Tools list behind it.
export const unstable_settings = { anchor: "index" };

export default function ToolsLayout() {
  const { t } = useTranslation();

  return (
    <Stack screenOptions={{ headerBackButtonDisplayMode: "minimal" }}>
      <Stack.Screen name="index" options={{ title: t("mobileNav.tools") }} />
      <Stack.Screen name="hydrometers/index" options={{ title: t("mobileHydrometers.title") }} />
      <Stack.Screen name="hydrometers/[deviceId]" options={{ title: t("mobileHydrometers.deviceTitle") }} />
      <Stack.Screen name="nutrients" options={{ title: t("calculators.nutes") }} />
      <Stack.Screen name="abv" options={{ title: t("calculators.extraCalcs.abv") }} />
      <Stack.Screen name="brix" options={{ title: t("calculators.extraCalcs.brix") }} />
      <Stack.Screen name="refractometer" options={{ title: t("calculators.extraCalcs.refractometer") }} />
      <Stack.Screen name="temperature" options={{ title: t("calculators.extraCalcs.tempCorrection") }} />
      <Stack.Screen name="estimated-og" options={{ title: t("calculators.extraCalcs.estOG") }} />
      <Stack.Screen name="stabilizers" options={{ title: t("mobileTools.tools.stabilizers") }} />
      <Stack.Screen name="sulfite" options={{ title: t("mobileTools.tools.sulfite") }} />
      <Stack.Screen name="sorbate" options={{ title: t("mobileTools.tools.sorbate") }} />
      <Stack.Screen name="blending" options={{ title: t("calculators.extraCalcs.blending") }} />
      <Stack.Screen name="bench-trials" options={{ title: t("calculators.extraCalcs.benchTrials") }} />
      <Stack.Screen name="priming-sugar" options={{ title: t("primingSugarHeading") }} />
      <Stack.Screen name="bottling" options={{ title: t("calculators.extraCalcs.bottling") }} />
      <Stack.Screen name="juice" options={{ title: t("juiceHeading") }} />
      <Stack.Screen name="yeasts" options={{ title: t("YeastTable:title") }} />
    </Stack>
  );
}

import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";

export default function ToolsLayout() {
  const { t } = useTranslation();

  return (
    <Stack screenOptions={{ headerBackButtonDisplayMode: "minimal" }}>
      <Stack.Screen name="index" options={{ title: t("mobileNav.tools") }} />
      <Stack.Screen name="abv" options={{ title: t("calculators.extraCalcs.abv") }} />
      <Stack.Screen name="brix" options={{ title: t("calculators.extraCalcs.brix") }} />
      <Stack.Screen name="refractometer" options={{ title: t("calculators.extraCalcs.refractometer") }} />
      <Stack.Screen name="temperature" options={{ title: t("calculators.extraCalcs.tempCorrection") }} />
      <Stack.Screen name="estimated-og" options={{ title: t("calculators.extraCalcs.estOG") }} />
    </Stack>
  );
}

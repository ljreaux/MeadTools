import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";

// A deep link to a brew keeps the brew list behind it.
export const unstable_settings = { anchor: "index" };

export default function BrewsLayout() {
  const { t } = useTranslation();

  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: t("brews.label") }} />
      <Stack.Screen name="[id]" options={{ title: t("mobileBrews.detailTitle") }} />
    </Stack>
  );
}

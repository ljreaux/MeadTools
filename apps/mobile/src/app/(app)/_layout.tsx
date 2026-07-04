import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";

export default function AppLayout() {
  const { t } = useTranslation();

  return (
    <Stack>
      <Stack.Screen name="brews" options={{ title: t("brews.label") }} />
    </Stack>
  );
}

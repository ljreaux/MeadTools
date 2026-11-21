import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";

// Keep the tab shell behind a modal that was opened from a deep link.
export const unstable_settings = { anchor: "(tabs)" };

export default function AppLayout() {
  const { t } = useTranslation();

  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="add-entry"
        options={{
          presentation: "modal",
          title: t("mobileBrews.addEntry.title")
        }}
      />
      <Stack.Screen
        name="edit-entry"
        options={{
          presentation: "modal",
          title: t("mobileBrews.editEntry.title")
        }}
      />
      <Stack.Screen
        name="bottling"
        options={{ presentation: "modal", title: t("mobileBrews.bottling.action") }}
      />
      <Stack.Screen
        name="new-brew"
        options={{ presentation: "modal", title: t("brews.new") }}
      />
      <Stack.Screen
        name="brew-settings"
        options={{ presentation: "modal", title: t("mobileBrews.settings.title") }}
      />
      <Stack.Screen
        name="recipe-snapshot"
        options={{ presentation: "modal", title: t("brews.snapshot.title") }}
      />
      <Stack.Screen
        name="change-stage"
        options={{
          presentation: "modal",
          title: t("mobileBrews.changeStage.title")
        }}
      />
    </Stack>
  );
}

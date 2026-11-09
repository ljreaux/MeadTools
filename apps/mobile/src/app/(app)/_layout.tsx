import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";

export default function AppLayout() {
  const { t } = useTranslation();

  return (
    <Stack>
      <Stack.Screen name="brews" options={{ title: t("brews.label") }} />
      <Stack.Screen
        name="brews/[id]"
        options={{ title: t("mobileBrews.detailTitle") }}
      />
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
        name="change-stage"
        options={{
          presentation: "modal",
          title: t("mobileBrews.changeStage.title")
        }}
      />
    </Stack>
  );
}

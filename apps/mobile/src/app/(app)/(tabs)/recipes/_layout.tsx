import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";

export const unstable_settings = { anchor: "index" };

export default function RecipesLayout() {
  const { t } = useTranslation();

  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: t("mobileNav.recipes") }} />
      <Stack.Screen name="[id]" options={{ title: t("mobileRecipes.detailTitle") }} />
    </Stack>
  );
}

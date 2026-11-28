import { Stack, router, useLocalSearchParams } from "expo-router";
import { Pressable, Text } from "react-native";
import { useTranslation } from "react-i18next";
import { HydrometerReadingsScreen } from "@/hydrometers/readings-screen";
import { useThemeColors } from "@/hooks/useThemeColors";
export default function BrewReadings() {
  const { brewId } = useLocalSearchParams<{ brewId: string }>();
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  return <>
    <Stack.Screen options={{ headerRight: () => <Pressable accessibilityRole="button" style={{ padding: 12, minHeight: 44 }} onPress={() => router.back()}><Text style={{ color: colors.text }}>{t("mobileHydrometers.done")}</Text></Pressable> }} />
    <HydrometerReadingsScreen brewId={brewId} />
  </>;
}

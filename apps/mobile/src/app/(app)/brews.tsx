import { Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { useTranslation } from "react-i18next";

import {
  colorThemes,
  radii,
  spacing,
  typography
} from "@meadtools/design-tokens";

import { useSession } from "@/providers/app-providers";
import { useThemeColors } from "@/hooks/useThemeColors";

export default function BrewsScreen() {
  const { colors } = useThemeColors();
  const styles = createStyles(colors);

  const { t } = useTranslation();
  const { signOut } = useSession();

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
    >
      <Text accessibilityRole="header" selectable style={styles.heading}>
        {t("brews.label")}
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => void signOut()}
        style={styles.button}
      >
        <Text style={styles.buttonText}>{t("account.logout")}</Text>
      </Pressable>
    </ScrollView>
  );
}

function createStyles(colors: typeof colorThemes.light) {
  return StyleSheet.create({
    content: {
      gap: spacing.xl,
      padding: spacing.xl
    },
    heading: {
      fontSize: typography.size.title,
      fontWeight: typography.weight.bold
    },
    button: {
      alignSelf: "flex-start",
      borderRadius: radii.md,
      backgroundColor: colors.accent,
      paddingHorizontal: 18,
      paddingVertical: spacing.md
    },
    buttonText: {
      color: colors.onAccent,
      fontWeight: typography.weight.bold
    }
  });
}

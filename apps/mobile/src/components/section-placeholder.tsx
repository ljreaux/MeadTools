import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { colorThemes, radii, spacing, typography } from "@meadtools/design-tokens";

import { useThemeColors } from "@/hooks/useThemeColors";

export type PlaceholderSection = "inventory" | "recipes";

/**
 * Holds a tab's place until its parity area adds real screens. It names what
 * is coming without links, prices or Premium calls to action.
 */
export function SectionPlaceholder({ section }: { section: PlaceholderSection }) {
  const { colors } = useThemeColors();
  const styles = createStyles(colors);
  const { t } = useTranslation();

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      style={styles.screen}
    >
      <View accessible style={styles.card}>
        <Text accessibilityRole="header" style={styles.title}>
          {t("mobileNav.placeholder.title")}
        </Text>
        <Text style={styles.body}>{t(`mobileNav.placeholder.${section}`)}</Text>
      </View>
    </ScrollView>
  );
}

function createStyles(colors: typeof colorThemes.light) {
  return StyleSheet.create({
    screen: { backgroundColor: colors.background },
    content: { flexGrow: 1, justifyContent: "center", padding: spacing.xl },
    card: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.lg,
      borderWidth: 1,
      gap: spacing.sm,
      padding: spacing.xl
    },
    title: {
      color: colors.text,
      fontSize: typography.size.action,
      fontWeight: typography.weight.bold,
      textAlign: "center"
    },
    body: {
      color: colors.textMuted,
      fontSize: typography.size.body,
      textAlign: "center"
    }
  });
}

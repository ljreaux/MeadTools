import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { colorThemes, radii, spacing, typography } from "@meadtools/design-tokens";

import { combinedCatalogStatus } from "@/catalogs/resolve-catalog";
import { useAllCatalogs } from "@/catalogs/use-catalog";
import { useThemeColors } from "@/hooks/useThemeColors";
import { toolGroups } from "@/tools/tool-list";

export default function ToolsScreen() {
  const { colors } = useThemeColors();
  const styles = createStyles(colors);
  const { t, i18n } = useTranslation();
  const status = combinedCatalogStatus(useAllCatalogs());
  const offlineText =
    status.kind === "ready"
      ? t("mobileTools.offline.ready", {
          date: new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium" }).format(new Date(status.updatedAt))
        })
      : t(`mobileTools.offline.${status.kind}`);

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      style={styles.screen}
    >
      {toolGroups.map((group) => (
        <View key={group.key} style={styles.group}>
          <Text accessibilityRole="header" style={styles.groupTitle}>
            {t(`mobileTools.groups.${group.key}`)}
          </Text>
          <View style={styles.card}>
            {group.tools.map((tool, index) => (
              <Pressable
                accessibilityRole="button"
                key={tool.href}
                onPress={() => router.push(tool.href)}
                style={({ pressed }) => [styles.row, index > 0 && styles.rowDivider, pressed && styles.pressed]}
              >
                <Text style={styles.rowText}>{t(tool.label)}</Text>
                <Text importantForAccessibility="no" accessibilityElementsHidden style={styles.chevron}>
                  ›
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ))}
      <View accessible style={styles.offline}>
        <Text style={styles.offlineTitle}>{t("mobileTools.offline.title")}</Text>
        <Text accessibilityLiveRegion="polite" style={styles.offlineText}>{offlineText}</Text>
      </View>
    </ScrollView>
  );
}

function createStyles(colors: typeof colorThemes.light) {
  return StyleSheet.create({
    screen: { backgroundColor: colors.background },
    content: { gap: spacing.xl, padding: spacing.xl },
    group: { gap: spacing.sm },
    groupTitle: {
      color: colors.textMuted,
      fontSize: typography.size.caption,
      fontWeight: typography.weight.bold,
      textTransform: "uppercase"
    },
    card: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.lg,
      borderWidth: 1,
      overflow: "hidden"
    },
    row: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.md,
      minHeight: 52,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md
    },
    rowDivider: { borderTopColor: colors.border, borderTopWidth: 1 },
    rowText: { color: colors.text, flex: 1, fontSize: typography.size.body },
    chevron: { color: colors.textMuted, fontSize: typography.size.action },
    pressed: { opacity: 0.7 },
    offline: { gap: spacing.xs },
    offlineTitle: { color: colors.textMuted, fontSize: typography.size.caption, fontWeight: typography.weight.bold },
    offlineText: { color: colors.textMuted, fontSize: typography.size.caption }
  });
}

import Constants from "expo-constants";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { colorThemes, radii, spacing, typography } from "@meadtools/design-tokens";

import { useThemeColors } from "@/hooks/useThemeColors";
import { useSession } from "@/providers/app-providers";

export default function AccountScreen() {
  const { colors } = useThemeColors();
  const styles = createStyles(colors);
  const { t } = useTranslation();
  const { session, signOut } = useSession();
  const version = Constants.expoConfig?.version;

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      style={styles.screen}
    >
      <View accessible style={styles.card}>
        <Text style={styles.label}>{t("mobileNav.signedInAs")}</Text>
        <Text selectable style={styles.email}>
          {session?.email}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={() => void signOut()}
        style={({ pressed }) => [styles.signOutButton, pressed && styles.pressed]}
      >
        <Text style={styles.signOutText}>{t("account.logout")}</Text>
      </Pressable>
      {version ? (
        <Text style={styles.version}>{t("mobileNav.version", { version })}</Text>
      ) : null}
    </ScrollView>
  );
}

function createStyles(colors: typeof colorThemes.light) {
  return StyleSheet.create({
    screen: { backgroundColor: colors.background },
    content: { gap: spacing.lg, padding: spacing.xl },
    card: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.lg,
      borderWidth: 1,
      gap: spacing.xs,
      padding: spacing.lg
    },
    label: { color: colors.textMuted, fontSize: typography.size.caption },
    email: {
      color: colors.text,
      fontSize: typography.size.action,
      fontWeight: typography.weight.bold
    },
    signOutButton: {
      alignItems: "center",
      borderColor: colors.border,
      borderRadius: radii.md,
      borderWidth: 1,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md
    },
    pressed: { opacity: 0.7 },
    signOutText: {
      color: colors.text,
      fontSize: typography.size.body,
      fontWeight: typography.weight.bold
    },
    version: {
      color: colors.textMuted,
      fontSize: typography.size.caption,
      textAlign: "center"
    }
  });
}

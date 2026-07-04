import { Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { useTranslation } from "react-i18next";

import { useSession } from "@/providers/app-providers";

export default function BrewsScreen() {
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

const styles = StyleSheet.create({
  content: {
    gap: 24,
    padding: 24
  },
  heading: {
    fontSize: 28,
    fontWeight: "700"
  },
  button: {
    alignSelf: "flex-start",
    borderRadius: 10,
    backgroundColor: "#F5A623",
    paddingHorizontal: 18,
    paddingVertical: 12
  },
  buttonText: {
    color: "#171717",
    fontWeight: "700"
  }
});

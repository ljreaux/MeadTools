import { ScrollView, StyleSheet, Text } from "react-native";
import { useTranslation } from "react-i18next";

export default function BrewsScreen() {
  const { t } = useTranslation();

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
    >
      <Text accessibilityRole="header" selectable style={styles.heading}>
        {t("brews.label")}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 24
  },
  heading: {
    fontSize: 28,
    fontWeight: "700"
  }
});

import { Image } from "expo-image";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

export default function WelcomeScreen() {
  const { t } = useTranslation();

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      style={styles.screen}
    >
      <View style={styles.glow} />
      <View style={styles.brandContainer}>
        <Image
          accessibilityLabel="MeadTools"
          source={require("@/assets/images/meadtools-logo.png")}
          style={styles.mark}
        />
        <Text accessibilityRole="header" selectable style={styles.brand}>
          {t("greeting")}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#171717"
  },
  content: {
    flexGrow: 1,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    padding: 24
  },
  glow: {
    position: "absolute",
    width: 360,
    height: 360,
    borderRadius: 180,
    backgroundColor: "#F5A623",
    opacity: 0.12
  },
  brandContainer: {
    alignItems: "center",
    gap: 18
  },
  mark: {
    width: 196,
    height: 168
  },
  brand: {
    color: "#FAFAFA",
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: 7
  }
});

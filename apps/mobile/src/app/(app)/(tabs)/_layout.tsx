import { NativeTabs } from "expo-router/unstable-native-tabs";
import { Platform } from "react-native";
import { useTranslation } from "react-i18next";

import { useThemeColors } from "@/hooks/useThemeColors";

// Icons follow the web account menu (Beer, NotebookPen, Package, CircleUser);
// Tools uses a calculator glyph. Android shows at most five native tabs, so
// later parity areas replace the placeholder screens instead of adding tabs.
export default function TabsLayout() {
  const { t } = useTranslation();
  const { colors } = useThemeColors();

  return (
    <NativeTabs
      backgroundColor={colors.surface}
      // Android draws the selected icon on the accent indicator pill; iOS has
      // no pill, so its selected icon keeps the text color.
      iconColor={{
        default: colors.text,
        selected: Platform.OS === "android" ? colors.onAccent : colors.text
      }}
      indicatorColor={colors.accent}
      labelStyle={{
        default: { color: colors.text },
        selected: { color: colors.text, fontWeight: "700" }
      }}
      labelVisibilityMode="labeled"
      tintColor={colors.text}
    >
      <NativeTabs.Trigger name="brews">
        <NativeTabs.Trigger.Icon
          md="sports_bar"
          sf={{ default: "mug", selected: "mug.fill" }}
        />
        <NativeTabs.Trigger.Label>{t("mobileNav.brews")}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="recipes">
        <NativeTabs.Trigger.Icon md="edit_note" sf="square.and.pencil" />
        <NativeTabs.Trigger.Label>{t("mobileNav.recipes")}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="tools">
        <NativeTabs.Trigger.Icon md="calculate" sf="plus.forwardslash.minus" />
        <NativeTabs.Trigger.Label>{t("mobileNav.tools")}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="inventory">
        <NativeTabs.Trigger.Icon
          md="package_2"
          sf={{ default: "shippingbox", selected: "shippingbox.fill" }}
        />
        <NativeTabs.Trigger.Label>{t("mobileNav.inventory")}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="account">
        <NativeTabs.Trigger.Icon
          md="account_circle"
          sf={{ default: "person.crop.circle", selected: "person.crop.circle.fill" }}
        />
        <NativeTabs.Trigger.Label>{t("mobileNav.account")}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

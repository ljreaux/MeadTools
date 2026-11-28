import { useQuery } from "@tanstack/react-query";
import { Link, type Href } from "expo-router";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, type TextStyle, View } from "react-native";
import { useTranslation } from "react-i18next";

import { MeadToolsApiError } from "@meadtools/api-client";
import type { HydrometerDeviceResponse } from "@meadtools/api-contract";
import { colorThemes, radii, spacing, typography } from "@meadtools/design-tokens";

import { isConnectionError } from "@/api/errors";
import { useThemeColors } from "@/hooks/useThemeColors";
import { HydrometerDeviceManagement } from "./device-management";
import { HydrometerDeviceActions } from "./device-actions";
import { useApiClient, useSession } from "@/providers/app-providers";

export function HydrometerDeviceScreen({ deviceId }: { deviceId?: string }) {
  const { t, i18n } = useTranslation();
  const { colors } = useThemeColors();
  const styles = createStyles(colors);
  const apiClient = useApiClient();
  const { session, signOut } = useSession();
  const query = useQuery({
    queryKey: ["hydrometerDevices", session?.id],
    queryFn: () => apiClient.listHydrometerDevices(),
    enabled: Boolean(session),
    retry: (count, error) => !(error instanceof MeadToolsApiError && error.status === 401) && count < 2
  });
  const sessionExpired = query.error instanceof MeadToolsApiError && query.error.status === 401;
  // Hide previous results on a failed refresh, especially after access is revoked.
  const devices = query.isError ? [] : (query.data ?? []);
  const device = devices.find((item) => item.id === deviceId);
  const deviceName = (item: HydrometerDeviceResponse) => item.device_name?.trim() || t("mobileHydrometers.unnamedDevice");
  const brewName = (item: HydrometerDeviceResponse) =>
    item.brew_id ? item.brews?.name?.trim() || t("mobileHydrometers.unnamedBrew") : t("mobileHydrometers.noBrew");

  function status() {
    if (query.isPending) return (
      <View style={styles.status}>
        <ActivityIndicator color={colors.accent} />
        <Text style={styles.body}>{t("mobileHydrometers.loading")}</Text>
      </View>
    );
    const failed = query.isError;
    const missing = deviceId !== undefined;
    return (
      <View style={styles.status}>
        <Text accessibilityRole="header" style={styles.title}>
          {t(sessionExpired ? "mobileBrews.sessionExpiredTitle" : failed ? "mobileHydrometers.errorTitle" : missing ? "mobileHydrometers.missingTitle" : "mobileHydrometers.emptyTitle")}
        </Text>
        <Text accessibilityLiveRegion="polite" style={styles.body}>
          {t(sessionExpired ? "mobileHydrometers.sessionExpiredBody" : isConnectionError(query.error) ? "mobileHydrometers.offlineBody" : failed ? "mobileHydrometers.errorBody" : missing ? "mobileHydrometers.missingBody" : "mobileHydrometers.emptyBody")}
        </Text>
        <Pressable accessibilityRole="button" onPress={() => void (sessionExpired ? signOut() : query.refetch())} style={styles.button}>
          <Text style={styles.buttonText}>{t(sessionExpired ? "mobileBrews.signInAgain" : "mobileHydrometers.refresh")}</Text>
        </Pressable>
        {missing && !sessionExpired ? (
          <TextLink href="/tools/hydrometers" label={t("mobileHydrometers.backToDevices")} style={styles.link} />
        ) : null}
      </View>
    );
  }

  function detail(item: HydrometerDeviceResponse) {
    const number = new Intl.NumberFormat(i18n.language, { maximumSignificantDigits: 12 });
    return (
      <View style={styles.card}>
        <Text accessibilityRole="header" style={styles.title}>{deviceName(item)}</Text>
        <Text style={styles.label}>{t("mobileHydrometers.deviceId")}</Text>
        <Text selectable style={styles.body}>{item.id}</Text>
        <Text style={styles.label}>{t("mobileHydrometers.attachedBrew")}</Text>
        <Text style={styles.body}>{brewName(item)}</Text>
        {item.brew_id ? (
          <Link asChild href={{ pathname: "/brews/[id]", params: { id: item.brew_id } }}>
            <Pressable accessibilityRole="link" style={styles.button}>
              <Text style={styles.buttonText}>{t("mobileHydrometers.openBrew")}</Text>
            </Pressable>
          </Link>
        ) : null}
        <Link asChild href={{ pathname: "/tools/hydrometers/readings", params: { deviceId: item.id } }}>
          <Pressable accessibilityRole="link" style={styles.button}><Text style={styles.buttonText}>{t("mobileHydrometers.readings")}</Text></Pressable>
        </Link>
        <HydrometerDeviceActions key={item.id} device={item} />
        <Text style={styles.label}>{t("mobileHydrometers.coefficients")}</Text>
        <Text selectable style={styles.body}>
          {item.coefficients.length ? item.coefficients.map((value) => number.format(value)).join("; ") : t("mobileHydrometers.noCoefficients")}
        </Text>
        <HydrometerDeviceManagement key={`manage-${item.id}`} device={item} />
      </View>
    );
  }

  return (
    <FlatList
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      data={deviceId === undefined ? devices : device ? [device] : []}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={deviceId === undefined ? <View style={{ gap: spacing.md }}><Text style={styles.body}>{t("mobileHydrometers.intro")}</Text><TextLink href="/tools/hydrometers/setup" label={t("mobileHydrometers.setup.title")} style={styles.link} /><TextLink href="/tools/hydrometers/brews" label={t("mobileHydrometers.lifecycle.brews")} style={styles.link} /></View> : null}
      ListEmptyComponent={status()}
      onRefresh={() => void query.refetch()}
      refreshing={query.isRefetching}
      renderItem={({ item }) => deviceId !== undefined ? detail(item) : (
        <Link asChild href={{ pathname: "/tools/hydrometers/[deviceId]", params: { deviceId: item.id } }}>
          <Pressable accessibilityRole="link" style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
            <Text style={styles.title}>{deviceName(item)}</Text>
            <Text style={styles.body}>{brewName(item)}</Text>
          </Pressable>
        </Link>
      )}
      style={styles.screen}
    />
  );
}

function createStyles(colors: typeof colorThemes.light) {
  return StyleSheet.create({
    screen: { backgroundColor: colors.background },
    content: { flexGrow: 1, gap: spacing.lg, padding: spacing.xl },
    card: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radii.lg, gap: spacing.md, padding: spacing.lg },
    title: { color: colors.text, fontSize: typography.size.action, fontWeight: typography.weight.bold },
    body: { color: colors.textMuted, fontSize: typography.size.body },
    label: { color: colors.text, fontSize: typography.size.body, fontWeight: typography.weight.bold },
    status: { alignItems: "center", gap: spacing.lg, paddingVertical: spacing.xxl },
    button: { alignSelf: "flex-start", minHeight: 44, justifyContent: "center", borderRadius: radii.md, backgroundColor: colors.accent, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
    buttonText: { color: colors.onAccent, fontWeight: typography.weight.bold, fontSize: typography.size.body },
    link: { color: colors.accent, fontSize: typography.size.body, minHeight: 44, paddingVertical: spacing.sm },
    pressed: { opacity: 0.7 }
  });
}

// A bare <Link> renders as text that Android does not expose as clickable, so
// screen readers miss it. Wrap the label like the screen's other links.
function TextLink({ href, label, style }: { href: Href; label: string; style: TextStyle }) {
  return (
    <Link asChild href={href}>
      <Pressable accessibilityRole="link" style={{ minHeight: style.minHeight, paddingVertical: style.paddingVertical, justifyContent: "center" }}>
        <Text style={{ color: style.color, fontSize: style.fontSize }}>{label}</Text>
      </Pressable>
    </Link>
  );
}

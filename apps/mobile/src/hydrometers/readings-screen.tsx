import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ActivityIndicator,
  Alert,
  AppState,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";
import { useTranslation } from "react-i18next";
import type { HydrometerLogResponse } from "@meadtools/api-contract";
import { MeadToolsApiError } from "@meadtools/api-client";
import {
  buildWirelessHydrometerChartData,
  hydrometerMetricSamples,
  readingGravity
} from "@meadtools/brew-domain/hydrometer";
import { radii, spacing, typography } from "@meadtools/design-tokens";

import { isConnectionError } from "@/api/errors";
import { Segmented } from "@/components/calculator-ui";
import { DateTimeField } from "@/components/date-time-field";
import { TimeSeriesChart } from "@/charts/time-series-chart";
import { useThemeColors } from "@/hooks/useThemeColors";
import { useApiClient, useSession } from "@/providers/app-providers";
import { HydrometerLogEditor } from "./log-editor";

const metrics = ["gravity", "temperature", "battery", "abv"] as const;

export function HydrometerReadingsScreen({
  deviceId,
  brewId
}: {
  deviceId?: string;
  brewId?: string;
}) {
  const { t, i18n } = useTranslation();
  const { colors } = useThemeColors();
  const api = useApiClient();
  const cache = useQueryClient();
  const { session, signOut } = useSession();
  const [foreground, setForeground] = useState(AppState.currentState === "active");
  useEffect(() => {
    const listener = AppState.addEventListener("change", (state) =>
      setForeground(state === "active")
    );
    return () => listener.remove();
  }, []);
  const [range, setRange] = useState(() => ({
    start: new Date(Date.now() - 86400000),
    end: new Date()
  }));
  const [appliedRange, setAppliedRange] = useState(range);
  const [liveRange, setLiveRange] = useState(true);
  const [allHistory, setAllHistory] = useState(false);
  const [gravityUnit, setGravityUnit] = useState<"SG" | "Brix">("SG");
  const [tempUnit, setTempUnit] = useState<"C" | "F">("C");
  const [editing, setEditing] = useState<HydrometerLogResponse | null>(null);
  const [mutationError, setMutationError] = useState(false);
  const validRange = range.start <= range.end;
  const query = useQuery({
    queryKey: [
      "hydrometerLogs",
      session?.id,
      deviceId ?? null,
      brewId ?? null,
      appliedRange.start.toISOString(),
      liveRange ? "live" : appliedRange.end.toISOString()
    ],
    queryFn: async () => {
      if (brewId) return api.listBrewHydrometerLogs(brewId);
      const owned = await api.listHydrometerDevices();
      if (!owned.some((device) => device.id === deviceId))
        throw new MeadToolsApiError(404, { error: "Device unavailable" });
      return api.listHydrometerLogs({
        deviceId: deviceId!,
        startDate: appliedRange.start.toISOString(),
        endDate: (liveRange ? new Date() : appliedRange.end).toISOString()
      });
    },
    enabled: Boolean(session && (deviceId || brewId)),
    refetchInterval: foreground ? 30_000 : false,
    retry: (count, error) =>
      !(error instanceof MeadToolsApiError && error.status === 401) && count < 1
  });
  const logs = useMemo(
    () =>
      query.isError
        ? []
        : [...(query.data ?? [])].sort((a, b) => Date.parse(b.datetime) - Date.parse(a.datetime)),
    [query.data, query.isError]
  );
  const points = useMemo(() => buildWirelessHydrometerChartData(logs, tempUnit), [logs, tempUnit]);
  const chartSeries = useMemo(
    () =>
      metrics.map((metric, index) => ({
        key: metric,
        label: t(`mobileHydrometers.metrics.${metric}`),
        samples: hydrometerMetricSamples(points, metric, gravityUnit),
        unit:
          metric === "gravity"
            ? gravityUnit
            : metric === "temperature"
              ? `°${tempUnit}`
              : metric === "abv"
                ? "%"
                : "",
        color: [colors.success, colors.error, colors.accent, colors.warning][index],
        digits: metric === "gravity" ? 4 : 2,
        initiallyVisible: metric === "gravity" || metric === "temperature",
        note: metric === "abv" ? t("mobileHydrometers.abvHint") : undefined
      })),
    [points, gravityUnit, tempUnit, colors, t]
  );
  const date = new Intl.DateTimeFormat(i18n.language, { dateStyle: "short", timeStyle: "short" });
  const number = new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 4 });
  const expired = query.error instanceof MeadToolsApiError && query.error.status === 401;
  const mutation = useMutation({
    mutationFn: (action: () => Promise<unknown>) => action(),
    onSuccess: async () => {
      setEditing(null);
      setMutationError(false);
      await cache.invalidateQueries({ queryKey: ["hydrometerLogs", session?.id] });
    },
    onError: () => setMutationError(true)
  });
  const action = (label: string, onPress: () => void, disabled = false) => (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.button, { borderColor: colors.border, opacity: disabled ? 0.45 : 1 }]}
    >
      <Text style={{ color: colors.text }}>{label}</Text>
    </Pressable>
  );
  function confirmDelete(log?: HydrometerLogResponse) {
    Alert.alert(
      t("mobileHydrometers.deleteLogs"),
      t(log ? "mobileHydrometers.deleteLogConfirm" : "mobileHydrometers.deleteRangeConfirm", {
        from: date.format(appliedRange.start),
        to: date.format(appliedRange.end)
      }),
      [
        { text: t("cancel"), style: "cancel" },
        {
          text: t("desktop.delete"),
          style: "destructive",
          onPress: () =>
            mutation.mutate(() =>
              log
                ? api.deleteHydrometerLog(log.id, log.device_id!)
                : api.deleteHydrometerLogsInRange({
                    deviceId: deviceId!,
                    startDate: appliedRange.start.toISOString(),
                    endDate: appliedRange.end.toISOString()
                  })
            )
        }
      ]
    );
  }
  if (!deviceId && !brewId) {
    return (
      <View style={[styles.content, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.text }}>{t("mobileHydrometers.missingTitle")}</Text>
      </View>
    );
  }

  const header = (
    <View style={styles.header}>
      {!brewId ? (
        <>
          <Text style={[styles.title, { color: colors.text }]}>
            {t("mobileHydrometers.dateRange")}
          </Text>
          {allHistory ? (
            <Text style={{ color: colors.textMuted }}>{t("mobileHydrometers.allHistory")}</Text>
          ) : (
            <>
              <Text style={{ color: colors.text }}>{t("mobileHydrometers.from")}</Text>
              <DateTimeField
                label={t("mobileHydrometers.from")}
                value={range.start}
                onChange={(start) => setRange((prior) => ({ ...prior, start }))}
              />
              <Text style={{ color: colors.text }}>{t("mobileHydrometers.to")}</Text>
              <DateTimeField
                label={t("mobileHydrometers.to")}
                value={range.end}
                onChange={(end) => setRange((prior) => ({ ...prior, end }))}
              />
              {!validRange ? (
                <Text style={{ color: colors.error }}>{t("mobileHydrometers.invalidRange")}</Text>
              ) : null}
            </>
          )}
          <View style={styles.actions}>
            {allHistory
              ? action(t("mobileHydrometers.chooseRange"), () => setAllHistory(false))
              : action(
                  t("mobileHydrometers.applyRange"),
                  () => {
                    setAppliedRange({ ...range });
                    setLiveRange(false);
                  },
                  !validRange
                )}
            {action(t("mobileHydrometers.allReadings"), () => {
              const next = { start: new Date(0), end: new Date() };
              setAllHistory(true);
              setAppliedRange(next);
              setLiveRange(true);
            })}
          </View>
        </>
      ) : null}
      <Text style={{ color: colors.textMuted }}>
        {t(brewId || liveRange ? "mobileHydrometers.liveRefresh" : "mobileHydrometers.fixedRange")}
      </Text>
      {query.isPending ? (
        <ActivityIndicator color={colors.accent} />
      ) : query.isError ? (
        <>
          <Text accessibilityLiveRegion="polite" style={{ color: colors.error }}>
            {t(
              expired
                ? "mobileHydrometers.sessionExpiredBody"
                : isConnectionError(query.error)
                  ? "mobileHydrometers.offlineBody"
                  : "mobileHydrometers.errorBody"
            )}
          </Text>
          {action(
            t(expired ? "mobileBrews.signInAgain" : "mobileHydrometers.refresh"),
            () => void (expired ? signOut() : query.refetch())
          )}
        </>
      ) : (
        <>
          <View style={styles.actions}>
            <View style={{ flex: 1, minWidth: 140, gap: spacing.sm }}>
              <Text style={{ color: colors.text }}>{t("mobileHydrometers.gravityUnit")}</Text>
              <Segmented
                label={t("mobileHydrometers.gravityUnit")}
                options={["SG", "Brix"]}
                value={gravityUnit}
                onChange={setGravityUnit}
                optionLabel={(value) => value}
              />
            </View>
            <View style={{ flex: 1, minWidth: 140, gap: spacing.sm }}>
              <Text style={{ color: colors.text }}>{t("temperature")}</Text>
              <Segmented
                label={t("temperature")}
                options={["C", "F"]}
                value={tempUnit}
                onChange={setTempUnit}
                optionLabel={(value) => `°${value}`}
              />
            </View>
          </View>
          <TimeSeriesChart series={chartSeries} />
          <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
            {t("mobileHydrometers.logsCount", { count: logs.length })}
          </Text>
          {deviceId && !liveRange && logs.length
            ? action(t("mobileHydrometers.deleteRange"), () => confirmDelete(), mutation.isPending)
            : null}
        </>
      )}
      {mutationError && !editing ? (
        <Text accessibilityLiveRegion="polite" style={{ color: colors.error }}>
          {t("mobileHydrometers.saveError")}
        </Text>
      ) : null}
    </View>
  );
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        data={logs}
        keyExtractor={(log) => log.id}
        onRefresh={() => void query.refetch()}
        refreshing={query.isRefetching}
        ListHeaderComponent={header}
        renderItem={({ item: log }) => (
          <View
            style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surface }]}
          >
            <Text style={[styles.title, { color: colors.text }]}>
              {date.format(new Date(log.datetime))}
            </Text>
            <Text style={{ color: colors.text }}>
              {number.format(readingGravity(log))} SG · {number.format(log.temperature)} °
              {log.temp_units}
            </Text>
            <Text style={{ color: colors.textMuted }}>
              {t("mobileHydrometers.fields.battery")}: {number.format(log.battery)} ·{" "}
              {t("mobileHydrometers.fields.angle")}: {number.format(log.angle)}°
            </Text>
            {log.device_id ? (
              <View style={styles.actions}>
                {action(
                  t("edit"),
                  () => {
                    setMutationError(false);
                    setEditing(log);
                  },
                  mutation.isPending
                )}
                {action(t("desktop.delete"), () => confirmDelete(log), mutation.isPending)}
              </View>
            ) : null}
          </View>
        )}
      />
      {editing ? (
        <HydrometerLogEditor
          key={editing.id}
          log={editing}
          onClose={() => setEditing(null)}
          busy={mutation.isPending}
          error={mutationError}
          onSave={(input) =>
            mutation.mutate(() => api.updateHydrometerLog(editing.id, editing.device_id!, input))
          }
        />
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  content: { padding: spacing.xl, gap: spacing.md },
  header: { gap: spacing.md },
  title: { fontSize: typography.size.action, fontWeight: typography.weight.bold },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  button: {
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    minHeight: 44,
    justifyContent: "center"
  },
  card: { borderWidth: 1, borderRadius: radii.lg, padding: spacing.lg, gap: spacing.sm }
});

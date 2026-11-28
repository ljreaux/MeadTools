import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Svg, { Circle, Line, Polyline } from "react-native-svg";
import { useTranslation } from "react-i18next";
import type { ChartSample } from "@meadtools/brew-domain/hydrometer";
import { radii, spacing, typography } from "@meadtools/design-tokens";

import { useThemeColors } from "@/hooks/useThemeColors";
import { overlayChartGeometry } from "./chart-geometry";

export type TimeSeries = {
  key: string;
  label: string;
  unit: string;
  color: string;
  samples: readonly ChartSample[];
  digits?: number;
  initiallyVisible?: boolean;
  note?: string;
};

/** Shared by manual brew charts (#591) and wireless charts (#613). */
export function TimeSeriesChart({
  series,
  markers = []
}: {
  series: readonly TimeSeries[];
  markers?: readonly { date: string; label: string }[];
}) {
  const { colors } = useThemeColors();
  const { t, i18n } = useTranslation();
  const { fontScale } = useWindowDimensions();
  // Axis labels sit in fixed columns beside the plot, so they stop growing at
  // AXIS_MAX_SCALE. The summaries below the chart give every value at full size.
  const axisScale = Math.min(fontScale, AXIS_MAX_SCALE);
  const axisWidth = Math.min(100, 62 * axisScale);
  const axisHeadingHeight = 44 * axisScale;
  const [width, setWidth] = useState(200);
  const [hidden, setHidden] = useState(
    () => new Set(series.filter((item) => item.initiallyVisible === false).map((item) => item.key))
  );
  const [selectedTime, setSelectedTime] = useState<number | null>(null);
  const visible = useMemo(() => series.filter((item) => !hidden.has(item.key)), [series, hidden]);
  const geometry = useMemo(() => overlayChartGeometry(visible, width, 210), [visible, width]);
  const date = new Intl.DateTimeFormat(i18n.language, { dateStyle: "short", timeStyle: "short" });
  const format = (value: number, item: TimeSeries) =>
    `${new Intl.NumberFormat(i18n.language, { maximumFractionDigits: item.digits ?? 2 }).format(value)} ${item.unit}`.trim();
  const configs = new Map(series.map((item) => [item.key, item]));
  const currentTime =
    geometry && selectedTime !== null && geometry.times.includes(selectedTime)
      ? selectedTime
      : geometry?.to;
  const currentIndex =
    geometry && currentTime !== undefined ? geometry.times.indexOf(currentTime) : -1;
  const nearest = (samples: readonly ChartSample[], time: number) =>
    samples.reduce((best, point) =>
      Math.abs(Date.parse(point.date) - time) < Math.abs(Date.parse(best.date) - time)
        ? point
        : best
    );
  const selection =
    geometry && currentTime !== undefined
      ? geometry.lines.map((line) => ({
          line,
          point: nearest(line.samples, currentTime),
          config: configs.get(line.key)!
        }))
      : [];

  function selectAt(position: number) {
    if (!geometry) return;
    const time =
      geometry.from + Math.max(0, Math.min(1, position / width)) * (geometry.to - geometry.from);
    setSelectedTime(
      geometry.times.reduce((best, value) =>
        Math.abs(value - time) < Math.abs(best - time) ? value : best
      )
    );
  }
  const scale = (index: number) => {
    const line = geometry?.lines[index];
    if (!line) return <View style={{ width: axisWidth }} />;
    const config = configs.get(line.key)!;
    return (
      <View
        accessible
        accessibilityLabel={`${config.label}: ${format(line.geometry.low, config)} – ${format(line.geometry.high, config)}`}
        style={{ width: axisWidth }}
      >
        <Text
          {...axisTextProps}
          style={[styles.axis, { color: config.color, height: axisHeadingHeight }]}
        >
          {config.unit || config.label}
        </Text>
        <View style={{ height: 210 }}>
          {[
            line.geometry.high,
            (line.geometry.high + line.geometry.low) / 2,
            line.geometry.low
          ].map((value, i) => (
            <Text
              key={i}
              {...axisTextProps}
              style={[
                styles.axis,
                {
                  position: "absolute",
                  top: i * 105 - 8 * axisScale,
                  width: axisWidth,
                  color: config.color
                }
              ]}
            >
              {new Intl.NumberFormat(i18n.language, {
                maximumFractionDigits: config.digits ?? 2
              }).format(value)}
            </Text>
          ))}
        </View>
      </View>
    );
  };
  return (
    <View style={styles.card}>
      <View accessibilityLabel={t("mobileHydrometers.chartMetric")} style={styles.legend}>
        {series.map((item) => (
          <Pressable
            key={item.key}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: !hidden.has(item.key) }}
            onPress={() =>
              setHidden((prior) => {
                const next = new Set(prior);
                if (next.has(item.key)) next.delete(item.key);
                else next.add(item.key);
                return next;
              })
            }
            style={[
              styles.legendItem,
              { borderColor: colors.border, opacity: hidden.has(item.key) ? 0.55 : 1 }
            ]}
          >
            <View
              style={[
                styles.swatch,
                {
                  backgroundColor: hidden.has(item.key) ? "transparent" : item.color,
                  borderColor: item.color
                }
              ]}
            />
            <Text style={{ color: colors.text, flexShrink: 1 }}>
              {item.label}
              {item.unit ? ` (${item.unit})` : ""}
            </Text>
          </Pressable>
        ))}
      </View>
      {!geometry ? (
        <Text style={{ color: colors.textMuted }}>
          {t(visible.length ? "mobileHydrometers.noReadings" : "mobileHydrometers.chooseSeries")}
        </Text>
      ) : (
        <>
          <View style={[styles.plotRow, { marginBottom: 12 * axisScale }]}>
            {scale(0)}
            <View
              style={[styles.plot, { paddingTop: axisHeadingHeight }]}
              onLayout={(event) => setWidth(Math.max(40, event.nativeEvent.layout.width))}
            >
              <View
                accessible={false}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                onStartShouldSetResponder={() => true}
                onResponderRelease={(event) => selectAt(event.nativeEvent.locationX)}
              >
                <Svg width={width} height={210} viewBox={`0 0 ${width} 210`}>
                  {[0, 105, 210].map((y) => (
                    <Line key={y} x1={0} x2={width} y1={y} y2={y} stroke={colors.border} />
                  ))}
                  {geometry.lines.map((line) => {
                    const config = configs.get(line.key)!;
                    return (
                      <Polyline
                        key={line.key}
                        points={line.polyline}
                        fill="none"
                        stroke={config.color}
                        strokeWidth={2}
                      />
                    );
                  })}
                  {geometry.lines.flatMap((line) =>
                    line.geometry.samples.length <= 2
                      ? line.geometry.samples.map((point, index) => (
                          <Circle
                            key={`${line.key}-${index}`}
                            cx={geometry.x(Date.parse(point.date))}
                            cy={line.geometry.y(point.value)}
                            r={4}
                            fill={configs.get(line.key)!.color}
                          />
                        ))
                      : []
                  )}
                  {markers
                    .filter(
                      (marker) =>
                        Date.parse(marker.date) >= geometry.from &&
                        Date.parse(marker.date) <= geometry.to
                    )
                    .map((marker) => (
                      <Line
                        key={`${marker.date}-${marker.label}`}
                        x1={geometry.x(Date.parse(marker.date))}
                        x2={geometry.x(Date.parse(marker.date))}
                        y1={0}
                        y2={210}
                        stroke={colors.textMuted}
                        strokeDasharray="4 4"
                      />
                    ))}
                  {currentTime !== undefined ? (
                    <Line
                      x1={geometry.x(currentTime)}
                      x2={geometry.x(currentTime)}
                      y1={0}
                      y2={210}
                      stroke={colors.textMuted}
                      strokeDasharray="2 4"
                    />
                  ) : null}
                  {selection.map(({ line, point, config }) => (
                    <Circle
                      key={line.key}
                      cx={geometry.x(Date.parse(point.date))}
                      cy={line.geometry.y(point.value)}
                      r={4}
                      fill={config.color}
                    />
                  ))}
                </Svg>
              </View>
            </View>
            {scale(1)}
          </View>
          {/* Side-by-side dates break mid-number at large text sizes, so stack them. */}
          <View style={[styles.dates, fontScale > AXIS_MAX_SCALE && styles.datesStacked]}>
            <Text style={[styles.date, { color: colors.textMuted }]}>
              {date.format(new Date(geometry.from))}
            </Text>
            <Text style={[styles.date, { color: colors.textMuted }]}>
              {date.format(new Date(geometry.to))}
            </Text>
          </View>
          {geometry.lines.map((line) => {
            const config = configs.get(line.key)!;
            return (
              <Text key={line.key} accessible style={{ color: colors.text }}>
                {t("mobileHydrometers.chartSummary", {
                  label: config.label,
                  count: line.samples.length,
                  min: format(line.geometry.min, config),
                  max: format(line.geometry.max, config),
                  latest: format(line.samples[line.samples.length - 1].value, config)
                })}
                {geometry.lines.length > 2
                  ? ` ${t("mobileHydrometers.axisRange", { from: format(line.geometry.low, config), to: format(line.geometry.high, config) })}`
                  : ""}
              </Text>
            );
          })}
          {visible
            .filter((item) => item.note)
            .map((item) => (
              <Text key={item.key} style={{ color: colors.textMuted }}>
                {item.note}
              </Text>
            ))}
          {markers
            .filter((marker) => Number.isFinite(Date.parse(marker.date)))
            .map((marker) => (
              <Text key={`${marker.date}-${marker.label}`} style={{ color: colors.textMuted }}>
                {marker.label}: {date.format(new Date(marker.date))}
              </Text>
            ))}
          <View accessibilityLiveRegion="polite" style={styles.readout}>
            {selection.map(({ line, point, config }) => (
              <Text key={line.key} style={{ color: colors.text }}>
                {config.label}: {format(point.value, config)} · {date.format(new Date(point.date))}
              </Text>
            ))}
          </View>
          <View style={styles.actions}>
            {([-1, 1] as const).map((direction) => {
              const disabled =
                direction < 0 ? currentIndex <= 0 : currentIndex >= geometry.times.length - 1;
              return (
                <Pressable
                  key={direction}
                  accessibilityRole="button"
                  accessibilityState={{ disabled }}
                  disabled={disabled}
                  onPress={() => setSelectedTime(geometry.times[currentIndex + direction])}
                  style={[
                    styles.button,
                    { borderColor: colors.border, opacity: disabled ? 0.45 : 1 }
                  ]}
                >
                  <Text style={{ color: colors.text }}>
                    {t(
                      direction < 0
                        ? "mobileHydrometers.previousReading"
                        : "mobileHydrometers.nextReading"
                    )}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </>
      )}
    </View>
  );
}
const AXIS_MAX_SCALE = 1.5;
// One line per axis label: a wrapped number such as "1.1 / 1" reads as two values.
const axisTextProps = {
  numberOfLines: 1,
  adjustsFontSizeToFit: true,
  minimumFontScale: 0.6,
  maxFontSizeMultiplier: AXIS_MAX_SCALE
} as const;

const styles = StyleSheet.create({
  card: { gap: spacing.md, paddingVertical: spacing.md },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  legendItem: {
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.sm,
    gap: spacing.sm,
    minHeight: 44,
    alignItems: "center",
    flexDirection: "row",
    maxWidth: "100%"
  },
  swatch: { width: 14, height: 14, borderWidth: 2, borderRadius: 3 },
  plotRow: { flexDirection: "row", gap: spacing.xs },
  plot: { flex: 1 },
  scale: { width: 62, minHeight: 252, justifyContent: "space-between" },
  axis: { fontSize: typography.size.caption, fontVariant: ["tabular-nums"] },
  dates: { flexDirection: "row", justifyContent: "space-between", gap: spacing.md },
  datesStacked: { flexDirection: "column", gap: spacing.xs },
  date: { flexGrow: 1, flexShrink: 1, fontSize: typography.size.caption },
  readout: { gap: spacing.xs },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  button: {
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    minHeight: 44,
    justifyContent: "center"
  }
});

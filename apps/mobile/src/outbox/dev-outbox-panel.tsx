import { useState, useSyncExternalStore } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colorThemes, radii, spacing, typography } from "@meadtools/design-tokens";

import { useThemeColors } from "@/hooks/useThemeColors";

import {
  getDevOutboxFault,
  setDevOutboxFault,
  subscribeDevOutboxFault,
  type DevOutboxFault
} from "./dev-fault-injection";
import { useGravityOutbox, useGravityOutboxRecords } from "./gravity-outbox-provider";

/** Readings queued from this panel in this app session, newest first. */
const queuedThisSession: string[] = [];

const FAULTS: DevOutboxFault[] = ["none", "offline", "lose-response"];

/**
 * Development-only verification panel for the gravity outbox (#444/#446).
 * Not localized and never rendered in release builds; the user-facing
 * gravity entry flow is #445.
 */
export function DevOutboxPanel({
  brewId,
  serverEntryIds
}: {
  brewId: string;
  serverEntryIds: readonly string[];
}) {
  const { colors } = useThemeColors();
  const styles = createStyles(colors);
  const outbox = useGravityOutbox();
  const records = useGravityOutboxRecords(brewId);
  const fault = useSyncExternalStore(
    subscribeDevOutboxFault,
    getDevOutboxFault,
    getDevOutboxFault
  );
  const [message, setMessage] = useState<string | null>(null);
  const [, rerender] = useState(0);

  if (!__DEV__ || !outbox) return null;

  async function queueReading() {
    try {
      const record = await outbox!.enqueue({
        brewId,
        gravity: 1.05,
        measuredAt: new Date(),
        note: "Dev outbox check"
      });
      queuedThisSession.unshift(record.clientEntryId);
      rerender((value) => value + 1);
      setMessage(`Queued ${record.clientEntryId}`);
    } catch (error) {
      setMessage(`Enqueue failed: ${error instanceof Error ? error.name : "unknown"}`);
    }
  }

  function button(label: string, onPress: () => void, selected = false) {
    return (
      <Pressable
        key={label}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        onPress={onPress}
        style={[styles.button, selected && styles.buttonSelected]}
      >
        <Text style={[styles.buttonText, selected && styles.buttonTextSelected]}>{label}</Text>
      </Pressable>
    );
  }

  const copies = (id: string) => serverEntryIds.filter((entryId) => entryId === id).length;

  return (
    <View style={styles.card} testID="dev-outbox-panel">
      <Text accessibilityRole="header" style={styles.heading}>Outbox (development)</Text>
      <Text style={styles.muted}>Fault injection</Text>
      <View style={styles.row}>
        {FAULTS.map((value) => button(value, () => setDevOutboxFault(value), fault === value))}
      </View>
      <View style={styles.row}>
        {button("Queue 1.050 SG", () => void queueReading())}
        {button("Replay", () => void outbox.replay("manual"))}
      </View>
      {message ? <Text style={styles.mono}>{message}</Text> : null}

      <Text style={styles.muted}>Outbox records for this brew: {records.length}</Text>
      {records.map((record) => (
        <View key={record.clientEntryId} style={styles.record}>
          <Text style={styles.mono}>{record.clientEntryId}</Text>
          <Text style={styles.text}>
            {record.delivery.status} · attempts {record.delivery.attempts}
            {record.delivery.error
              ? ` · ${record.delivery.error.kind}${record.delivery.error.status ? ` ${record.delivery.error.status}` : ""}`
              : ""}
          </Text>
          <Text style={styles.muted}>measured {record.measuredAt}</Text>
          <View style={styles.row}>
            {button("Retry", () => void outbox.retry(record.clientEntryId))}
            {button("Discard", () => void outbox.discard(record.clientEntryId))}
          </View>
        </View>
      ))}

      {queuedThisSession.length > 0 ? (
        <>
          <Text style={styles.muted}>Queued this session → server copies</Text>
          {queuedThisSession.slice(0, 5).map((id) => (
            <Text key={id} style={styles.mono}>
              {id.slice(-12)} → {copies(id)} · {records.some((record) => record.clientEntryId === id) ? "in outbox" : "retired"}
            </Text>
          ))}
        </>
      ) : null}
    </View>
  );
}

function createStyles(colors: typeof colorThemes.light) {
  return StyleSheet.create({
    card: {
      borderColor: colors.accent,
      borderRadius: radii.lg,
      borderStyle: "dashed",
      borderWidth: 1,
      backgroundColor: colors.surface,
      gap: spacing.sm,
      padding: spacing.lg
    },
    heading: { color: colors.text, fontSize: typography.size.action, fontWeight: typography.weight.bold },
    text: { color: colors.text, fontSize: typography.size.body },
    muted: { color: colors.textMuted, fontSize: typography.size.caption },
    mono: { color: colors.text, fontFamily: "Menlo", fontSize: typography.size.caption },
    row: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    record: { borderTopColor: colors.border, borderTopWidth: 1, gap: spacing.xs, paddingTop: spacing.sm },
    button: {
      borderColor: colors.border,
      borderRadius: radii.md,
      borderWidth: 1,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm
    },
    buttonSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
    buttonText: { color: colors.text, fontSize: typography.size.caption },
    buttonTextSelected: { color: colors.onAccent, fontWeight: typography.weight.bold }
  });
}

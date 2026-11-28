import { useCallback, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { Link, useFocusEffect } from "expo-router";
import { useTranslation } from "react-i18next";
import type { HydrometerDeviceResponse } from "@meadtools/api-contract";
import { linkHydrometerWithUnassignedLogs } from "@meadtools/brew-domain/hydrometer-lifecycle";
import { spacing } from "@meadtools/design-tokens";
import { useApiClient } from "@/providers/app-providers";
import { useThemeColors } from "@/hooks/useThemeColors";
import {
  HydrometerActionButton,
  HydrometerChoiceSheet,
  HydrometerNameSheet,
  HydrometerNotice
} from "./lifecycle-ui";
import { useHydrometerAction, useHydrometerCollections } from "./use-lifecycle";

export function HydrometerDeviceActions({ device }: { device: HydrometerDeviceResponse }) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const api = useApiClient();
  const action = useHydrometerAction();
  const { brews } = useHydrometerCollections();
  const [sheet, setSheet] = useState<"start" | "link" | null>(null);
  const [notice, setNotice] = useState<
    "started" | "linked" | "importFailed" | "imported" | "unlinked" | null
  >(null);
  useFocusEffect(
    useCallback(() => {
      setNotice(null);
    }, [])
  );
  const disabled = action.busy || !action.online;
  const choices = (brews.isError ? [] : (brews.data ?? []))
    .filter((brew) => brew.end_date === null)
    .map((brew) => ({
      id: brew.id,
      name: brew.name?.trim() || t("mobileHydrometers.unnamedBrew"),
      description: t(`brewStage.${brew.stage}`)
    }));
  function chooseBrew(brewId: string) {
    setSheet(null);
    Alert.alert(
      t("mobileHydrometers.lifecycle.linkBrew"),
      t("mobileHydrometers.lifecycle.linkConfirm"),
      [
        { text: t("cancel"), style: "cancel" },
        {
          text: t("mobileHydrometers.lifecycle.link"),
          onPress: () => {
            void (async () => {
              const result = await action.run(() =>
                linkHydrometerWithUnassignedLogs({
                  attach: () => api.attachHydrometerDevice(brewId, device.id),
                  importLogs: () => api.importUnassignedHydrometerLogs(brewId, device.id)
                })
              );
              if (result) setNotice(result.value.imported ? "linked" : "importFailed");
            })();
          }
        }
      ]
    );
  }
  return (
    <View style={styles.section}>
      <HydrometerNotice failure={action.failure} offline={!action.online} />
      {notice ? (
        <Text accessibilityLiveRegion="polite" style={{ color: colors.text }}>
          {t(`mobileHydrometers.lifecycle.notices.${notice}`)}
        </Text>
      ) : null}
      {device.brew_id ? (
        <>
          <Link
            href={{
              pathname: "/tools/hydrometers/brews/[brewId]",
              params: { brewId: device.brew_id }
            }}
            style={{ color: colors.accent, paddingVertical: spacing.md }}
          >
            {t("mobileHydrometers.lifecycle.manageBrew")}
          </Link>
          <HydrometerActionButton
            label={t("mobileHydrometers.lifecycle.unlink")}
            disabled={disabled}
            onPress={() =>
              Alert.alert(
                t("mobileHydrometers.lifecycle.unlink"),
                t("mobileHydrometers.lifecycle.unlinkConfirm"),
                [
                  { text: t("cancel"), style: "cancel" },
                  {
                    text: t("mobileHydrometers.lifecycle.unlink"),
                    onPress: () => {
                      void (async () => {
                        const result = await action.run(() =>
                          api.unlinkHydrometerDevice(device.brew_id!, device.id)
                        );
                        if (result) setNotice("unlinked");
                      })();
                    }
                  }
                ]
              )
            }
          />
          {notice === "importFailed" ? (
            <HydrometerActionButton
              label={t("mobileHydrometers.lifecycle.importLogs")}
              disabled={disabled}
              onPress={() => {
                void (async () => {
                  const result = await action.run(() =>
                    api.importUnassignedHydrometerLogs(device.brew_id!, device.id)
                  );
                  if (result) setNotice("imported");
                })();
              }}
            />
          ) : null}
        </>
      ) : (
        <View style={styles.actions}>
          <HydrometerActionButton
            label={t("mobileHydrometers.lifecycle.start")}
            disabled={disabled}
            onPress={() => {
              action.clearFailure();
              setSheet("start");
            }}
          />
          <HydrometerActionButton
            label={t("mobileHydrometers.lifecycle.linkBrew")}
            disabled={disabled}
            onPress={() => {
              action.clearFailure();
              setSheet("link");
            }}
          />
        </View>
      )}
      {sheet === "start" ? (
        <HydrometerNameSheet
          title={t("mobileHydrometers.lifecycle.start")}
          busy={action.busy}
          online={action.online}
          failure={action.failure}
          onClose={() => setSheet(null)}
          onSubmit={(name) => {
            void (async () => {
              const result = await action.run(() => api.startHydrometerBrew(device.id, name));
              if (result) {
                setSheet(null);
                setNotice("started");
              }
            })();
          }}
        />
      ) : null}
      {sheet === "link" ? (
        <HydrometerChoiceSheet
          title={t("mobileHydrometers.lifecycle.linkBrew")}
          choices={choices}
          loading={brews.isPending}
          error={brews.isError}
          onRetry={() => void brews.refetch()}
          onClose={() => setSheet(null)}
          onChoose={chooseBrew}
        />
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }
});

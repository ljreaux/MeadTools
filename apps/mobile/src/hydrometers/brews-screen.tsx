import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { Link } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { MeadToolsApiError } from "@meadtools/api-client";
import {
  linkableHydrometerDevices,
  linkHydrometerWithUnassignedLogs,
  searchHydrometerChoices
} from "@meadtools/brew-domain/hydrometer-lifecycle";
import { radii, spacing, typography } from "@meadtools/design-tokens";
import { isConnectionError } from "@/api/errors";
import { CalculatorSwitch, Segmented } from "@/components/calculator-ui";
import { useApiClient, useSession } from "@/providers/app-providers";
import { useThemeColors } from "@/hooks/useThemeColors";
import {
  HydrometerActionButton,
  HydrometerChoiceSheet,
  HydrometerNameSheet,
  HydrometerNotice
} from "./lifecycle-ui";
import { useHydrometerAction, useHydrometerCollections } from "./use-lifecycle";

export function HydrometerBrewsScreen({ brewId }: { brewId?: string }) {
  const { t, i18n } = useTranslation();
  const { colors } = useThemeColors();
  const api = useApiClient();
  const { session, signOut } = useSession();
  const { brews, devices } = useHydrometerCollections();
  const action = useHydrometerAction();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"active" | "completed" | "all">("active");
  const [sheet, setSheet] = useState<"rename" | "recipe" | "device" | null>(null);
  const [notice, setNotice] = useState<
    | "linked"
    | "importFailed"
    | "imported"
    | "unlinked"
    | "ended"
    | "renamed"
    | "recipeLinked"
    | null
  >(null);
  const [alertsDraft, setAlertsDraft] = useState<boolean | null>(null);
  const recipes = useQuery({
    queryKey: ["recipes", session?.id],
    queryFn: () => api.listRecipes(),
    enabled: Boolean(session && sheet === "recipe")
  });
  const ownedBrews = brews.isError ? [] : (brews.data ?? []);
  const brew = ownedBrews.find((item) => item.id === brewId);
  const ownedDevices = devices.isError ? [] : (devices.data ?? []);
  const linked = ownedDevices.filter((device) => device.brew_id === brewId);
  const names = ownedBrews.map((item) => ({
    id: item.id,
    name: item.name?.trim() || t("mobileHydrometers.unnamedBrew"),
    description: item.end_date ? "completed" : "active"
  }));
  const rows = searchHydrometerChoices(
    names.filter((item) => status === "all" || item.description === status),
    search
  );
  const disabled = action.busy || !action.online;
  const expired = brews.error instanceof MeadToolsApiError && brews.error.status === 401;
  const date = new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium" });

  function runLink(deviceId: string) {
    setSheet(null);
    Alert.alert(
      t("mobileHydrometers.lifecycle.linkDevice"),
      t("mobileHydrometers.lifecycle.linkConfirm"),
      [
        { text: t("cancel"), style: "cancel" },
        {
          text: t("mobileHydrometers.lifecycle.link"),
          onPress: () => {
            void (async () => {
              const result = await action.run(() =>
                linkHydrometerWithUnassignedLogs({
                  attach: () => api.attachHydrometerDevice(brewId!, deviceId),
                  importLogs: () => api.importUnassignedHydrometerLogs(brewId!, deviceId)
                })
              );
              if (result) setNotice(result.value.imported ? "linked" : "importFailed");
            })();
          }
        }
      ]
    );
  }
  const failure = (
    <View style={styles.section}>
      {brews.isPending ? (
        <ActivityIndicator color={colors.accent} />
      ) : (
        <>
          <Text style={{ color: colors.textMuted }}>
            {t(
              expired
                ? "mobileHydrometers.sessionExpiredBody"
                : isConnectionError(brews.error)
                  ? "mobileHydrometers.lifecycle.offlineBody"
                  : brews.isError
                    ? "mobileHydrometers.errorBody"
                    : "mobileHydrometers.lifecycle.brewUnavailable"
            )}
          </Text>
          <HydrometerActionButton
            label={t(expired ? "mobileBrews.signInAgain" : "mobileHydrometers.refresh")}
            onPress={() => void (expired ? signOut() : brews.refetch())}
          />
        </>
      )}
    </View>
  );
  if (brewId && !brew)
    return (
      <View style={[styles.content, { flex: 1, backgroundColor: colors.background }]}>
        {failure}
      </View>
    );

  if (!brewId)
    return (
      <FlatList
        data={rows}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        keyExtractor={(item) => item.id}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
        style={{ backgroundColor: colors.background }}
        onRefresh={() => void brews.refetch()}
        refreshing={brews.isRefetching}
        ListHeaderComponent={
          <View style={styles.section}>
            <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
              {t("mobileHydrometers.lifecycle.brews")}
            </Text>
            <Segmented
              label={t("mobileBrews.list.show")}
              options={["active", "completed", "all"]}
              value={status}
              onChange={setStatus}
              optionLabel={(value) => t(`mobileBrews.list.status.${value}`)}
            />
            <TextInput
              accessibilityLabel={t("mobileBrews.list.search")}
              value={search}
              onChangeText={setSearch}
              autoCorrect={false}
              placeholder={t("mobileBrews.list.search")}
              placeholderTextColor={colors.placeholder}
              style={[styles.input, { color: colors.text, borderColor: colors.border }]}
            />
          </View>
        }
        ListEmptyComponent={
          brews.isError || brews.isPending ? (
            failure
          ) : (
            <Text style={{ color: colors.textMuted }}>
              {t("mobileHydrometers.lifecycle.noChoices")}
            </Text>
          )
        }
        renderItem={({ item }) => (
          <Link
            href={{ pathname: "/tools/hydrometers/brews/[brewId]", params: { brewId: item.id } }}
            asChild
          >
            <Pressable
              accessibilityRole="link"
              style={StyleSheet.flatten([styles.card, { borderColor: colors.border }])}
            >
              <Text style={[styles.label, { color: colors.text }]}>{item.name}</Text>
            </Pressable>
          </Link>
        )}
      />
    );

  const snapshotName = brew!.recipe_snapshot?.name;
  const recipeName =
    typeof snapshotName === "string" ? snapshotName : t("mobileHydrometers.lifecycle.linkedRecipe");
  return (
    <FlatList
      data={linked}
      keyExtractor={(device) => device.id}
      style={{ backgroundColor: colors.background }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
      onRefresh={() => {
        void brews.refetch();
        void devices.refetch();
      }}
      refreshing={brews.isRefetching || devices.isRefetching}
      ListHeaderComponent={
        <View style={styles.section}>
          <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
            {brew!.name?.trim() || t("mobileHydrometers.unnamedBrew")}
          </Text>
          <Text style={{ color: colors.textMuted }}>
            {t(
              brew!.end_date
                ? "mobileHydrometers.lifecycle.completed"
                : "mobileHydrometers.lifecycle.active"
            )}
          </Text>
          <Text style={{ color: colors.textMuted }}>
            {t("mobileBrews.started", { date: date.format(new Date(brew!.start_date)) })}
          </Text>
          {brew!.end_date ? (
            <Text style={{ color: colors.textMuted }}>
              {t("mobileBrews.list.ended", { date: date.format(new Date(brew!.end_date)) })}
            </Text>
          ) : null}
          <View style={styles.actions}>
            <Link href={{ pathname: "/brews/[id]", params: { id: brewId } }} asChild>
              <Pressable accessibilityRole="link" style={styles.link}>
                <Text style={{ color: colors.accent }}>{t("mobileHydrometers.openBrew")}</Text>
              </Pressable>
            </Link>
            <Link href={{ pathname: "/hydrometer-readings", params: { brewId } }} asChild>
              <Pressable accessibilityRole="link" style={styles.link}>
                <Text style={{ color: colors.accent }}>{t("mobileHydrometers.readings")}</Text>
              </Pressable>
            </Link>
          </View>
          <HydrometerNotice failure={action.failure} offline={!action.online} />
          {notice ? (
            <Text accessibilityLiveRegion="polite" style={{ color: colors.text }}>
              {t(`mobileHydrometers.lifecycle.notices.${notice}`)}
            </Text>
          ) : null}
          <HydrometerActionButton
            label={t("mobileHydrometers.lifecycle.rename")}
            disabled={disabled}
            onPress={() => {
              action.clearFailure();
              setSheet("rename");
            }}
          />
          <CalculatorSwitch
            label={t("iSpindelDashboard.receiveEmailAlerts")}
            disabled={disabled}
            value={alertsDraft ?? Boolean(brew!.requested_email_alerts)}
            onValueChange={(value) => {
              setAlertsDraft(value);
              void (async () => {
                await action.run(() => api.setHydrometerBrewAlerts(brewId, value));
                setAlertsDraft(null);
              })();
            }}
          />
          <Text style={{ color: colors.text }}>
            {brew!.recipe_id ? recipeName : t("mobileHydrometers.lifecycle.noRecipe")}
          </Text>
          <HydrometerActionButton
            label={t("mobileHydrometers.lifecycle.linkRecipe")}
            disabled={disabled}
            onPress={() => {
              action.clearFailure();
              setSheet("recipe");
            }}
          />
          <HydrometerActionButton
            label={t("mobileHydrometers.lifecycle.linkDevice")}
            disabled={disabled || devices.isPending || devices.isError}
            onPress={() => {
              action.clearFailure();
              setSheet("device");
            }}
          />
          {devices.isError ? (
            <HydrometerActionButton
              label={t("mobileHydrometers.refresh")}
              onPress={() => void devices.refetch()}
            />
          ) : null}
          <Text accessibilityRole="header" style={[styles.label, { color: colors.text }]}>
            {t("mobileHydrometers.lifecycle.linkedDevices")}
          </Text>
        </View>
      }
      ListEmptyComponent={
        <Text style={{ color: colors.textMuted }}>
          {t(
            devices.isPending
              ? "mobileHydrometers.loading"
              : "mobileHydrometers.lifecycle.noLinkedDevices"
          )}
        </Text>
      }
      renderItem={({ item: device }) => (
        <View style={[styles.card, { borderColor: colors.border }]}>
          <Link
            href={{ pathname: "/tools/hydrometers/[deviceId]", params: { deviceId: device.id } }}
            style={[styles.label, { color: colors.accent }]}
          >
            {device.device_name?.trim() || t("mobileHydrometers.unnamedDevice")}
          </Link>
          <View style={styles.actions}>
            <HydrometerActionButton
              label={t("mobileHydrometers.lifecycle.importLogs")}
              disabled={disabled}
              onPress={() => {
                void (async () => {
                  const result = await action.run(() =>
                    api.importUnassignedHydrometerLogs(brewId, device.id)
                  );
                  if (result) setNotice("imported");
                })();
              }}
            />
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
                            api.unlinkHydrometerDevice(brewId, device.id)
                          );
                          if (result) setNotice("unlinked");
                        })();
                      }
                    }
                  ]
                )
              }
            />
            {!brew!.end_date ? (
              <HydrometerActionButton
                label={t("mobileHydrometers.lifecycle.end")}
                disabled={disabled}
                onPress={() =>
                  Alert.alert(
                    t("mobileHydrometers.lifecycle.end"),
                    t("mobileHydrometers.lifecycle.endConfirm", {
                      device: device.device_name ?? t("mobileHydrometers.unnamedDevice")
                    }),
                    [
                      { text: t("cancel"), style: "cancel" },
                      {
                        text: t("mobileHydrometers.lifecycle.end"),
                        onPress: () => {
                          void (async () => {
                            const result = await action.run(() =>
                              api.endHydrometerBrew(brewId, device.id)
                            );
                            if (result) setNotice("ended");
                          })();
                        }
                      }
                    ]
                  )
                }
              />
            ) : null}
          </View>
        </View>
      )}
      ListFooterComponent={
        <>
          {sheet === "rename" ? (
            <HydrometerNameSheet
              title={t("mobileHydrometers.lifecycle.rename")}
              initialName={brew!.name ?? ""}
              busy={action.busy}
              online={action.online}
              failure={action.failure}
              onClose={() => setSheet(null)}
              onSubmit={(name) => {
                void (async () => {
                  const result = await action.run(() => api.renameHydrometerBrew(brewId, name));
                  if (result) {
                    setSheet(null);
                    setNotice("renamed");
                  }
                })();
              }}
            />
          ) : null}
          {sheet === "recipe" ? (
            <HydrometerChoiceSheet
              title={t("mobileHydrometers.lifecycle.linkRecipe")}
              loading={recipes.isPending}
              error={recipes.isError}
              onRetry={() => void recipes.refetch()}
              choices={(recipes.isError ? [] : (recipes.data ?? [])).map((recipe) => ({
                id: String(recipe.id),
                name: recipe.name,
                disabled: recipe.id === brew!.recipe_id
              }))}
              onClose={() => setSheet(null)}
              onChoose={(id) => {
                setSheet(null);
                Alert.alert(
                  t("mobileHydrometers.lifecycle.linkRecipe"),
                  t("mobileHydrometers.lifecycle.recipeConfirm"),
                  [
                    { text: t("cancel"), style: "cancel" },
                    {
                      text: t("mobileHydrometers.lifecycle.link"),
                      onPress: () => {
                        void (async () => {
                          const result = await action.run(() =>
                            api.linkHydrometerBrewRecipe(brewId, Number(id))
                          );
                          if (result) setNotice("recipeLinked");
                        })();
                      }
                    }
                  ]
                );
              }}
            />
          ) : null}
          {sheet === "device" ? (
            <HydrometerChoiceSheet
              title={t("mobileHydrometers.lifecycle.linkDevice")}
              loading={devices.isPending}
              error={devices.isError}
              onRetry={() => void devices.refetch()}
              choices={linkableHydrometerDevices(ownedDevices, brewId).map((device) => ({
                id: device.id,
                name: device.device_name?.trim() || t("mobileHydrometers.unnamedDevice"),
                disabled: device.brew_id === brewId,
                description: device.brew_id
                  ? t("mobileHydrometers.lifecycle.alreadyLinked")
                  : t("mobileHydrometers.noBrew")
              }))}
              onClose={() => setSheet(null)}
              onChoose={runLink}
            />
          ) : null}
        </>
      }
    />
  );
}
const styles = StyleSheet.create({
  content: { padding: spacing.xl, gap: spacing.md },
  section: { gap: spacing.md },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  title: { fontSize: typography.size.title, fontWeight: typography.weight.bold },
  label: { fontSize: typography.size.body, fontWeight: typography.weight.bold },
  input: {
    borderWidth: 1,
    borderRadius: radii.md,
    minHeight: 48,
    padding: spacing.md,
    fontSize: typography.size.body
  },
  card: { borderWidth: 1, borderRadius: radii.lg, padding: spacing.lg, gap: spacing.md },
  link: { paddingVertical: spacing.md, minHeight: 44, fontSize: typography.size.body }
});

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View
} from "react-native";
import { useTranslation } from "react-i18next";

import { MeadToolsApiError } from "@meadtools/api-client";
import {
  projectBrewViewListItem,
  type BrewStage,
  type BrewViewListItem
} from "@meadtools/brew-domain";
import {
  brewListRecipeOptions,
  queryBrewList,
  type BrewListRecipeFilter,
  type BrewListSort,
  type BrewListStageFilter,
  type BrewListStatus
} from "@meadtools/brew-domain/brew-list";
import { colorThemes, radii, spacing, typography } from "@meadtools/design-tokens";

import { Chips, Segmented } from "@/components/calculator-ui";
import { isConnectionError as isConnectionFailure } from "@/api/errors";
import { useThemeColors } from "@/hooks/useThemeColors";
import { useApiClient, useSession } from "@/providers/app-providers";

const STATUSES = ["active", "completed", "all"] as const satisfies readonly BrewListStatus[];
const STAGES = [
  "PLANNED",
  "PRIMARY",
  "SECONDARY",
  "BULK_AGE",
  "STABILIZED",
  "BACKSWEETENED",
  "PACKAGED",
  "COMPLETE"
] as const satisfies readonly BrewStage[];
const SORTS = {
  startAsc: { key: "start_date", direction: "asc" },
  startDesc: { key: "start_date", direction: "desc" },
  endDesc: { key: "end_date", direction: "desc" },
  endAsc: { key: "end_date", direction: "asc" }
} as const satisfies Record<string, BrewListSort>;
type SortOption = keyof typeof SORTS;
const SORT_OPTIONS = Object.keys(SORTS) as SortOption[];
/** Oldest start first, the order the brew list has always used. */
const DEFAULT_SORT: SortOption = "startAsc";
const ALL = "all";
const NO_RECIPE = "none";

export default function BrewsScreen() {
  const { colors } = useThemeColors();
  const styles = createStyles(colors);
  const { t, i18n } = useTranslation();
  const { fontScale } = useWindowDimensions();
  const stackHeading = fontScale >= LARGE_TEXT_SCALE;
  const apiClient = useApiClient();
  const { session, signOut } = useSession();
  const brewsQuery = useQuery({
    queryKey: ["brews", session?.id],
    queryFn: () => apiClient.listBrews(),
    enabled: Boolean(session),
    select: (brews) => brews.map(projectBrewViewListItem)
  });
  const isSessionError =
    brewsQuery.error instanceof MeadToolsApiError &&
    brewsQuery.error.status === 401;
  const isConnectionError = isConnectionFailure(brewsQuery.error);
  const allBrews = useMemo(
    () => (isSessionError ? [] : (brewsQuery.data ?? [])),
    [brewsQuery.data, isSessionError]
  );

  const [status, setStatus] = useState<BrewListStatus>("active");
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState<BrewListStageFilter>(ALL);
  const [recipe, setRecipe] = useState<string>(ALL);
  const [sort, setSort] = useState<SortOption>(DEFAULT_SORT);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const recipeFilter: BrewListRecipeFilter =
    recipe === ALL || recipe === NO_RECIPE ? recipe : Number(recipe);
  const recipeOptions = useMemo(() => brewListRecipeOptions(allBrews), [allBrews]);
  const recipeNames = useMemo(
    () => new Map(recipeOptions.map((option) => [String(option.id), option.name])),
    [recipeOptions]
  );
  const statusBrews = useMemo(
    () => queryBrewList(allBrews, { status }),
    [allBrews, status]
  );
  const brews = useMemo(
    () =>
      queryBrewList(allBrews, {
        status,
        stage,
        recipe: recipeFilter,
        search: search.trim(),
        sort: SORTS[sort]
      }),
    [allBrews, status, stage, recipeFilter, search, sort]
  );
  const activeFilterCount =
    (stage !== ALL ? 1 : 0) + (recipe !== ALL ? 1 : 0) + (sort !== DEFAULT_SORT ? 1 : 0);
  const isNarrowed = search.trim() !== "" || stage !== ALL || recipe !== ALL;
  const hasLoaded = !brewsQuery.isPending && !brewsQuery.isError;

  function clearFilters() {
    setSearch("");
    setStage(ALL);
    setRecipe(ALL);
    setSort(DEFAULT_SORT);
  }

  function renderStatus() {
    if (brewsQuery.isPending) {
      return (
        <View style={styles.status}>
          <ActivityIndicator color={colors.accent} />
          <Text style={styles.statusBody}>{t("mobileBrews.loading")}</Text>
        </View>
      );
    }

    if (brewsQuery.isError) {
      return (
        <View
          accessibilityRole="alert"
          style={[styles.status, brews.length > 0 && styles.statusBanner]}
        >
          <Text style={styles.statusTitle}>
            {t(
              isSessionError
                ? "mobileBrews.sessionExpiredTitle"
                : isConnectionError
                  ? "mobileBrews.offlineTitle"
                  : "mobileBrews.errorTitle"
            )}
          </Text>
          <Text style={styles.statusBody}>
            {t(
              isSessionError
                ? "mobileBrews.sessionExpiredBody"
                : isConnectionError
                  ? "mobileBrews.offlineBody"
                  : "mobileBrews.errorBody"
            )}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => void (isSessionError ? signOut() : brewsQuery.refetch())}
            style={styles.retryButton}
          >
            <Text style={styles.retryText}>
              {t(isSessionError ? "mobileBrews.signInAgain" : "mobileBrews.retry")}
            </Text>
          </Pressable>
        </View>
      );
    }

    if (statusBrews.length > 0 && isNarrowed) {
      return (
        <View style={styles.status}>
          <Text style={styles.statusTitle}>{t("mobileBrews.list.noMatchesTitle")}</Text>
          <Text style={styles.statusBody}>{t("mobileBrews.list.noMatchesBody")}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={clearFilters}
            style={styles.retryButton}
          >
            <Text style={styles.retryText}>{t("brews.filters.clear")}</Text>
          </Pressable>
        </View>
      );
    }

    return (
      <View style={styles.status}>
        <Text style={styles.statusTitle}>
          {t(
            status === "completed"
              ? "mobileBrews.list.emptyCompletedTitle"
              : status === "all"
                ? "mobileBrews.list.emptyAllTitle"
                : "mobileBrews.emptyTitle"
          )}
        </Text>
        <Text style={styles.statusBody}>
          {t(
            status === "completed"
              ? "mobileBrews.list.emptyCompletedBody"
              : "mobileBrews.emptyBody"
          )}
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => void brewsQuery.refetch()}
          style={styles.retryButton}
        >
          <Text style={styles.retryText}>{t("mobileBrews.refresh")}</Text>
        </Pressable>
      </View>
    );
  }

  const dateFormatter = new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium" });
  function formatDate(value: string) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : dateFormatter.format(date);
  }

  function renderFilters() {
    return (
      <View style={styles.filters}>
        <Text style={styles.filterLabel}>{t("brews.stage")}</Text>
        <Chips<BrewListStageFilter>
          label={t("brews.stage")}
          onChange={setStage}
          optionLabel={(option) =>
            option === ALL ? t("brews.filters.allStages") : t(`brewStage.${option}`)
          }
          options={[ALL, ...STAGES]}
          value={stage}
        />
        <Text style={styles.filterLabel}>{t("brews.filters.recipe.label")}</Text>
        <Chips<string>
          label={t("brews.filters.recipe.label")}
          onChange={setRecipe}
          optionLabel={(option) =>
            option === ALL
              ? t("brews.filters.recipe.all")
              : option === NO_RECIPE
                ? t("brews.filters.recipe.none")
                : (recipeNames.get(option) ?? option)
          }
          options={[ALL, NO_RECIPE, ...recipeOptions.map((option) => String(option.id))]}
          value={recipe}
        />
        <Text style={styles.filterLabel}>{t("mobileBrews.list.sort")}</Text>
        <Chips<SortOption>
          label={t("mobileBrews.list.sort")}
          onChange={setSort}
          optionLabel={(option) => t(`mobileBrews.list.sorts.${option}`)}
          options={SORT_OPTIONS}
          value={sort}
        />
        {activeFilterCount > 0 ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setStage(ALL);
              setRecipe(ALL);
              setSort(DEFAULT_SORT);
            }}
            style={styles.textButton}
          >
            <Text style={styles.textButtonLabel}>{t("brews.filters.clear")}</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  function renderListControls() {
    return (
      <View style={styles.controls}>
        <Segmented
          label={t("mobileBrews.list.show")}
          onChange={setStatus}
          optionLabel={(option) => t(`mobileBrews.list.status.${option}`)}
          options={STATUSES}
          value={status}
        />
        <TextInput
          accessibilityLabel={t("mobileBrews.list.search")}
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
          onChangeText={setSearch}
          placeholder={t("mobileBrews.list.search")}
          placeholderTextColor={colors.placeholder}
          returnKeyType="search"
          style={styles.search}
          value={search}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: filtersOpen }}
          onPress={() => setFiltersOpen((open) => !open)}
          style={styles.textButton}
        >
          <Text style={styles.textButtonLabel}>
            {activeFilterCount > 0
              ? t("mobileBrews.list.filtersCount", { count: activeFilterCount })
              : t("brews.filters.label")}
            {filtersOpen ? " ▴" : " ▾"}
          </Text>
        </Pressable>
        {filtersOpen ? renderFilters() : null}
      </View>
    );
  }

  function renderBrew({ item: brew }: { item: BrewViewListItem }) {
    const name = brew.name?.trim() || brew.recipe_name || t("mobileBrews.untitled");
    const volume = brew.current_volume_liters;

    return (
      // A style function on a Pressable inside <Link asChild> is dropped, so
      // navigate directly to keep the card style and press feedback.
      <Pressable
        accessibilityRole="link"
        onPress={() => router.push({ pathname: "/brews/[id]", params: { id: brew.id } })}
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      >
        <View style={[styles.cardHeading, stackHeading && styles.cardHeadingStacked]}>
          <Text numberOfLines={2} style={styles.brewName}>
            {name}
          </Text>
          <Text style={styles.stage}>{t(`brewStage.${brew.stage}`)}</Text>
        </View>
        {brew.recipe_name && brew.recipe_name !== name ? (
          <Text numberOfLines={1} style={styles.detailText}>
            {brew.recipe_name}
          </Text>
        ) : null}
        <View style={styles.metadata}>
          {brew.end_date ? (
            <Text style={styles.detailText}>
              {t("mobileBrews.list.ended", { date: formatDate(brew.end_date) })}
            </Text>
          ) : (
            <Text style={styles.detailText}>
              {t("mobileBrews.started", { date: formatDate(brew.start_date) })}
            </Text>
          )}
          {volume !== null ? (
            <Text style={styles.detailText}>
              {t("mobileBrews.volume", {
                value: new Intl.NumberFormat(i18n.language, {
                  maximumFractionDigits: 1
                }).format(volume)
              })}
            </Text>
          ) : null}
          <Text style={styles.detailText}>
            {t("mobileBrews.entries", { count: brew.entry_count })}
          </Text>
        </View>
      </Pressable>
    );
  }

  return (
    <FlatList
      contentContainerStyle={[styles.content, brews.length === 0 && styles.emptyContent]}
      contentInsetAdjustmentBehavior="automatic"
      data={brews}
      keyExtractor={(brew) => brew.id}
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      ListEmptyComponent={renderStatus}
      ListHeaderComponent={
        <View>
          <View style={styles.header}>
            <View>
              <Text accessibilityRole="header" style={styles.heading}>
                {t("brews.label")}
              </Text>
              {hasLoaded ? (
                <Text accessibilityLiveRegion="polite" style={styles.count}>
                  {t(
                    status === "completed"
                      ? "mobileBrews.list.completedCount"
                      : status === "all"
                        ? "mobileBrews.list.allCount"
                        : "mobileBrews.activeCount",
                    { count: brews.length }
                  )}
                </Text>
              ) : null}
            </View>
            {!isSessionError ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push("/new-brew")}
                style={({ pressed }) => [styles.newButton, pressed && styles.cardPressed]}
              >
                <Text style={styles.newButtonText}>{t("brews.new")}</Text>
              </Pressable>
            ) : null}
          </View>
          {hasLoaded || allBrews.length > 0 ? renderListControls() : null}
          {brews.length > 0 && brewsQuery.isError ? renderStatus() : null}
        </View>
      }
      onRefresh={() => void brewsQuery.refetch()}
      refreshing={brewsQuery.isRefetching}
      renderItem={renderBrew}
      style={styles.list}
    />
  );
}

/** Font scale from which side-by-side text no longer fits a phone row. */
const LARGE_TEXT_SCALE = 1.35;

function createStyles(colors: typeof colorThemes.light) {
  return StyleSheet.create({
    list: { backgroundColor: colors.background },
    content: {
      gap: spacing.md,
      padding: spacing.xl
    },
    emptyContent: { flexGrow: 1 },
    header: {
      alignItems: "flex-start",
      flexDirection: "row",
      // At the largest text sizes New Brew moves below the heading.
      flexWrap: "wrap",
      justifyContent: "space-between",
      gap: spacing.md,
      marginBottom: spacing.md
    },
    heading: {
      color: colors.text,
      fontSize: typography.size.title,
      fontWeight: typography.weight.bold
    },
    newButton: {
      backgroundColor: colors.accent,
      borderRadius: radii.md,
      justifyContent: "center",
      minHeight: 44,
      paddingHorizontal: spacing.lg
    },
    newButtonText: { color: colors.onAccent, fontWeight: typography.weight.bold },
    count: {
      color: colors.textMuted,
      fontSize: typography.size.caption,
      marginTop: spacing.xs
    },
    card: {
      borderColor: colors.border,
      borderRadius: radii.lg,
      borderWidth: 1,
      backgroundColor: colors.surface,
      gap: spacing.sm,
      padding: spacing.lg
    },
    cardPressed: { opacity: 0.7 },
    cardHeading: {
      alignItems: "flex-start",
      flexDirection: "row",
      justifyContent: "space-between",
      gap: spacing.md
    },
    // Large text sizes leave no room beside the stage pill, so it moves below.
    cardHeadingStacked: { flexDirection: "column", gap: spacing.sm },
    brewName: {
      color: colors.text,
      flexShrink: 1,
      flexGrow: 1,
      fontSize: typography.size.action,
      fontWeight: typography.weight.bold
    },
    stage: {
      color: colors.onAccent,
      backgroundColor: colors.accent,
      borderRadius: radii.round,
      fontSize: typography.size.caption,
      overflow: "hidden",
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs
    },
    metadata: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
    controls: { gap: spacing.md, marginBottom: spacing.md },
    search: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.lg,
      borderWidth: 1,
      color: colors.text,
      fontSize: typography.size.body,
      minHeight: 48,
      paddingHorizontal: spacing.lg
    },
    filters: { gap: spacing.sm },
    filterLabel: {
      color: colors.textMuted,
      fontSize: typography.size.caption,
      fontWeight: typography.weight.bold
    },
    textButton: {
      alignSelf: "flex-start",
      justifyContent: "center",
      minHeight: 44
    },
    textButtonLabel: {
      color: colors.accent,
      fontSize: typography.size.body,
      fontWeight: typography.weight.bold
    },
    detailText: { color: colors.textMuted, fontSize: typography.size.caption },
    status: {
      alignItems: "center",
      flex: 1,
      justifyContent: "center",
      gap: spacing.md,
      paddingVertical: spacing.xxl
    },
    statusBanner: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.lg,
      borderWidth: 1,
      flex: 0,
      marginBottom: spacing.md,
      padding: spacing.lg
    },
    statusTitle: {
      color: colors.text,
      fontSize: typography.size.action,
      fontWeight: typography.weight.bold,
      textAlign: "center"
    },
    statusBody: {
      color: colors.textMuted,
      fontSize: typography.size.body,
      textAlign: "center"
    },
    retryButton: {
      borderRadius: radii.md,
      backgroundColor: colors.accent,
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.md
    },
    retryText: { color: colors.onAccent, fontWeight: typography.weight.bold }
  });
}

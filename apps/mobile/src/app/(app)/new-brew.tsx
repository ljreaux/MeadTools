import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { useTranslation } from "react-i18next";

import { MeadToolsApiError } from "@meadtools/api-client";
import {
  newBrewName,
  searchNewBrewRecipes,
  type NewBrewRecipeOption
} from "@meadtools/brew-domain/new-brew";
import { colorThemes, radii, spacing, typography } from "@meadtools/design-tokens";

import { isConnectionError } from "@/api/errors";
import { useIsOnline } from "@/hooks/useIsOnline";
import { useThemeColors } from "@/hooks/useThemeColors";
import { useApiClient, useSession } from "@/providers/app-providers";

type CreateFailure = "offline" | "session" | "notFound" | "failed";

function failureFor(error: unknown): CreateFailure {
  if (isConnectionError(error)) return "offline";
  if (error instanceof MeadToolsApiError) {
    if (error.status === 401) return "session";
    if (error.status === 404) return "notFound";
  }
  return "failed";
}

export default function NewBrewScreen() {
  const { colors } = useThemeColors();
  const styles = createStyles(colors);
  const { t } = useTranslation();
  const apiClient = useApiClient();
  const { session } = useSession();
  const queryClient = useQueryClient();
  const online = useIsOnline();

  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<NewBrewRecipeOption | null>(null);
  const [nameDraft, setNameDraft] = useState("");
  const [failure, setFailure] = useState<CreateFailure | null>(null);
  // A second tap before the first request settles must not start a second brew.
  const inFlight = useRef(false);

  const recipesQuery = useQuery({
    queryKey: ["recipes", session?.id],
    queryFn: () => apiClient.listRecipes(),
    enabled: Boolean(session),
    select: (recipes): NewBrewRecipeOption[] =>
      recipes.map((recipe) => ({
        id: recipe.id,
        name: recipe.name.trim() || t("untitledRecipe")
      }))
  });
  const recipes = useMemo(
    () => searchNewBrewRecipes(recipesQuery.data ?? [], search),
    [recipesQuery.data, search]
  );

  const create = useMutation({
    mutationFn: (recipe: NewBrewRecipeOption) =>
      apiClient.createBrew({
        recipe_id: recipe.id,
        name: newBrewName(nameDraft, recipe.name)
      })
  });

  function choose(recipe: NewBrewRecipeOption) {
    setSelected(recipe);
    setNameDraft(recipe.name);
    setFailure(null);
  }

  async function start() {
    if (!selected || inFlight.current) return;
    inFlight.current = true;
    setFailure(null);
    try {
      const brew = await create.mutateAsync(selected);
      void queryClient.invalidateQueries({ queryKey: ["brews", session?.id] });
      router.back();
      router.push({ pathname: "/brews/[id]", params: { id: brew.id } });
    } catch (error) {
      setFailure(failureFor(error));
    } finally {
      inFlight.current = false;
    }
  }

  if (selected) {
    const busy = create.isPending;
    const disabled = busy || !online;
    return (
      <ScrollView
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
      >
        <Text accessibilityRole="header" style={styles.title}>
          {t("brews.newBrew.confirmTitle")}
        </Text>
        <Text style={styles.body}>
          {t("brews.newBrew.confirmHelp", { recipeName: selected.name })}
        </Text>
        <View style={styles.field}>
          <Text style={styles.label}>
            {t("mobileBrews.newBrew.nameLabel")}
          </Text>
          <TextInput
            accessibilityLabel={t("mobileBrews.newBrew.nameLabel")}
            autoCorrect={false}
            clearButtonMode="while-editing"
            editable={!busy}
            onChangeText={setNameDraft}
            placeholder={t("brews.newBrew.namePlaceholder")}
            placeholderTextColor={colors.placeholder}
            returnKeyType="done"
            style={styles.input}
            value={nameDraft}
          />
          <Text style={styles.hint}>{t("mobileBrews.newBrew.nameHint")}</Text>
        </View>
        {!online ? (
          <Text accessibilityRole="alert" style={styles.notice}>
            {t("mobileBrews.newBrew.offline")}
          </Text>
        ) : null}
        {failure ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {t(`mobileBrews.newBrew.errors.${failure}`)}
          </Text>
        ) : null}
        <Pressable
          // An explicit label: on Android a Pressable without one keeps
          // "busy" as its description after `busy` turns false.
          accessibilityLabel={busy ? t("creating") : t("start")}
          accessibilityRole="button"
          accessibilityState={{ disabled, busy }}
          disabled={disabled}
          onPress={() => void start()}
          style={({ pressed }) => [
            styles.primaryButton,
            disabled && styles.buttonDisabled,
            pressed && styles.pressed
          ]}
        >
          {busy ? <ActivityIndicator color={colors.onAccent} /> : null}
          <Text style={styles.primaryButtonText}>
            {busy ? t("creating") : t("start")}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={() => {
            setSelected(null);
            setFailure(null);
          }}
          style={({ pressed }) => [styles.textButton, pressed && styles.pressed]}
        >
          <Text style={styles.textButtonLabel}>
            {t("mobileBrews.newBrew.chooseAnother")}
          </Text>
        </Pressable>
      </ScrollView>
    );
  }

  function renderEmpty() {
    if (recipesQuery.isPending) {
      return (
        <View style={styles.status}>
          <ActivityIndicator color={colors.accent} />
          <Text style={styles.body}>{t("mobileBrews.newBrew.loading")}</Text>
        </View>
      );
    }
    if (recipesQuery.isError) {
      return (
        <View accessibilityRole="alert" style={styles.status}>
          <Text style={styles.statusTitle}>{t("mobileBrews.newBrew.loadErrorTitle")}</Text>
          <Text style={styles.body}>
            {t(
              isConnectionError(recipesQuery.error)
                ? "mobileBrews.offlineBody"
                : "mobileBrews.errorBody"
            )}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => void recipesQuery.refetch()}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
          >
            <Text style={styles.primaryButtonText}>{t("mobileBrews.retry")}</Text>
          </Pressable>
        </View>
      );
    }
    if ((recipesQuery.data ?? []).length === 0) {
      return (
        <View style={styles.status}>
          <Text style={styles.statusTitle}>{t("mobileBrews.newBrew.noRecipesTitle")}</Text>
          <Text style={styles.body}>{t("mobileBrews.newBrew.noRecipesBody")}</Text>
        </View>
      );
    }
    return (
      <View style={styles.status}>
        <Text style={styles.body}>{t("noResults")}</Text>
      </View>
    );
  }

  return (
    <FlatList
      contentContainerStyle={[styles.content, recipes.length === 0 && styles.grow]}
      contentInsetAdjustmentBehavior="automatic"
      data={recipes}
      keyExtractor={(recipe) => String(recipe.id)}
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      ListEmptyComponent={renderEmpty}
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={styles.body}>{t("brews.newBrew.help")}</Text>
          {!online ? (
            <Text accessibilityRole="alert" style={styles.notice}>
              {t("mobileBrews.newBrew.offline")}
            </Text>
          ) : null}
          {(recipesQuery.data ?? []).length > 0 ? (
            <TextInput
              accessibilityLabel={t("mobileBrews.newBrew.search")}
              autoCapitalize="none"
              autoCorrect={false}
              clearButtonMode="while-editing"
              onChangeText={setSearch}
              placeholder={t("mobileBrews.newBrew.search")}
              placeholderTextColor={colors.placeholder}
              returnKeyType="search"
              style={styles.input}
              value={search}
            />
          ) : null}
        </View>
      }
      onRefresh={() => void recipesQuery.refetch()}
      refreshing={recipesQuery.isRefetching}
      renderItem={({ item }) => (
        <Pressable
          accessibilityHint={t("mobileBrews.newBrew.chooseHint")}
          accessibilityRole="button"
          onPress={() => choose(item)}
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        >
          <Text style={styles.rowText}>{item.name}</Text>
          <Text importantForAccessibility="no" style={styles.chevron}>›</Text>
        </Pressable>
      )}
      style={styles.screen}
    />
  );
}

function createStyles(colors: typeof colorThemes.light) {
  return StyleSheet.create({
    screen: { backgroundColor: colors.background },
    content: { gap: spacing.sm, padding: spacing.xl },
    grow: { flexGrow: 1 },
    header: { gap: spacing.md, marginBottom: spacing.sm },
    title: {
      color: colors.text,
      fontSize: typography.size.title,
      fontWeight: typography.weight.bold
    },
    body: { color: colors.textMuted, fontSize: typography.size.body },
    field: { gap: spacing.sm, marginTop: spacing.md },
    label: {
      color: colors.text,
      fontSize: typography.size.body,
      fontWeight: typography.weight.bold
    },
    hint: { color: colors.textMuted, fontSize: typography.size.caption },
    input: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.lg,
      borderWidth: 1,
      color: colors.text,
      fontSize: typography.size.body,
      minHeight: 48,
      paddingHorizontal: spacing.lg
    },
    notice: {
      color: colors.text,
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.md,
      borderWidth: 1,
      fontSize: typography.size.body,
      padding: spacing.md
    },
    error: { color: colors.error, fontSize: typography.size.body, fontWeight: typography.weight.bold },
    row: {
      alignItems: "center",
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.lg,
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing.md,
      minHeight: 56,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md
    },
    rowText: {
      color: colors.text,
      flex: 1,
      fontSize: typography.size.action,
      fontWeight: typography.weight.bold
    },
    chevron: { color: colors.textMuted, fontSize: typography.size.title },
    primaryButton: {
      alignItems: "center",
      alignSelf: "stretch",
      backgroundColor: colors.accent,
      borderRadius: radii.md,
      flexDirection: "row",
      gap: spacing.sm,
      justifyContent: "center",
      marginTop: spacing.md,
      minHeight: 48,
      paddingHorizontal: spacing.xl
    },
    primaryButtonText: {
      color: colors.onAccent,
      fontSize: typography.size.body,
      fontWeight: typography.weight.bold
    },
    buttonDisabled: { opacity: 0.5 },
    textButton: { alignSelf: "center", justifyContent: "center", minHeight: 44 },
    textButtonLabel: {
      color: colors.accent,
      fontSize: typography.size.body,
      fontWeight: typography.weight.bold
    },
    pressed: { opacity: 0.7 },
    status: {
      alignItems: "center",
      flex: 1,
      gap: spacing.md,
      justifyContent: "center",
      paddingVertical: spacing.xxl
    },
    statusTitle: {
      color: colors.text,
      fontSize: typography.size.action,
      fontWeight: typography.weight.bold,
      textAlign: "center"
    }
  });
}

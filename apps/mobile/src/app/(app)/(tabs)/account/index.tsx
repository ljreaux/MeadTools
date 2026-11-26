import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Constants from "expo-constants";
import { Image } from "expo-image";
import { useState } from "react";
import {
  ActivityIndicator, Keyboard, Pressable, ScrollView, StyleSheet, Switch, Text,
  TextInput, View
} from "react-native";
import { useTranslation } from "react-i18next";

import {
  publicUsernameInputSchema,
  type AccountProfile,
  type UpdateAccountProfileInput
} from "@meadtools/api-contract";
import { colorThemes, radii, spacing, typography } from "@meadtools/design-tokens";

import { useThemeColors } from "@/hooks/useThemeColors";
import { useApiClient, useSession } from "@/providers/app-providers";

export default function AccountScreen() {
  const { colors } = useThemeColors();
  const styles = createStyles(colors);
  const { t } = useTranslation();
  const { session, signOut } = useSession();
  const version = Constants.expoConfig?.version;

  return (
    <ScrollView
      automaticallyAdjustKeyboardInsets
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      style={styles.screen}
    >
      {session ? (
        <View key={session.id} style={styles.accountSections}>
          <ProfileSettings userId={session.id} email={session.email} />
          <AccountStatus userId={session.id} />
          <EmailPreferences userId={session.id} />
        </View>
      ) : null}
      <Pressable
        accessibilityRole="button"
        onPress={() => void signOut()}
        style={({ pressed }) => [styles.signOutButton, pressed && styles.pressed]}
      >
        <Text style={styles.signOutText}>{t("account.logout")}</Text>
      </Pressable>
      {version ? (
        <Text style={styles.version}>{t("mobileNav.version", { version })}</Text>
      ) : null}
    </ScrollView>
  );
}

function EmailPreferences({ userId }: { userId: number }) {
  const { colors } = useThemeColors();
  const styles = createStyles(colors);
  const { t } = useTranslation();
  const apiClient = useApiClient();
  const queryClient = useQueryClient();
  const queryKey = ["account-release-email", userId] as const;
  const [draft, setDraft] = useState<boolean | null>(null);
  const preference = useQuery({
    queryKey,
    queryFn: () => apiClient.getReleaseEmailPreferences()
  });
  const save = useMutation({
    mutationFn: (optedIn: boolean) => apiClient.updateReleaseEmailPreferences({ optedIn }),
    onSuccess: async (result) => {
      await queryClient.cancelQueries({ queryKey });
      queryClient.setQueryData(queryKey, result);
      setDraft(null);
    }
  });

  const optedIn = draft ?? preference.data?.optedIn ?? false;
  const saveDisabled =
    save.isPending || !preference.data ||
    (preference.data.prompted && optedIn === preference.data.optedIn);

  return (
    <View style={styles.card}>
      <View style={styles.field}>
        <Text accessibilityRole="header" style={styles.email}>{t("releaseEmails.title")}</Text>
        <Text style={styles.label}>{t("releaseEmails.settingsDescription")}</Text>
      </View>
      {preference.isPending ? (
        <ActivityIndicator
          color={colors.accent}
          accessibilityLabel={t("mobileAccount.loadingEmailPreference")}
        />
      ) : null}
      {preference.isLoadingError ? (
        <View style={styles.field}>
          <Text accessibilityRole="alert" style={styles.error}>{t("releaseEmails.loadError")}</Text>
          <Pressable
            accessibilityRole="button"
            disabled={preference.isFetching}
            onPress={() => void preference.refetch()}
            style={styles.signOutButton}
          >
            <Text style={styles.signOutText}>{t("mobileAccount.retry")}</Text>
          </Pressable>
        </View>
      ) : null}
      {preference.data ? (
        <View style={styles.field}>
          <View style={styles.avatarSetting}>
            <Text style={[styles.label, styles.identity]}>{t("releaseEmails.optIn")}</Text>
            <Switch
              accessibilityLabel={t("releaseEmails.optIn")}
              disabled={save.isPending}
              value={optedIn}
              onValueChange={(value) => {
                setDraft(value);
                save.reset();
              }}
            />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ busy: save.isPending, disabled: saveDisabled }}
            disabled={saveDisabled}
            onPress={() => save.mutate(optedIn)}
            style={({ pressed }) => [styles.saveButton, (pressed || saveDisabled) && styles.pressed]}
          >
            <Text style={styles.saveText}>{t("releaseEmails.save")}</Text>
          </Pressable>
          {save.isSuccess ? (
            <Text accessibilityLiveRegion="polite" style={styles.label}>{t("releaseEmails.saved")}</Text>
          ) : null}
          {save.isError ? (
            <Text accessibilityRole="alert" style={styles.error}>{t("releaseEmails.saveError")}</Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function AccountStatus({ userId }: { userId: number }) {
  const { colors } = useThemeColors();
  const styles = createStyles(colors);
  const { t, i18n } = useTranslation();
  const apiClient = useApiClient();
  const premium = useQuery({
    queryKey: ["account-premium", userId],
    queryFn: () => apiClient.getPremiumStatus()
  });
  const credits = useQuery({
    queryKey: ["account-credits", userId],
    queryFn: () => apiClient.getCreditBalance()
  });
  const refreshing = premium.isFetching || credits.isFetching;
  const status = premium.data;
  let premiumLabel: string | undefined;

  if (status?.paymentRestricted) {
    premiumLabel = t("premium.restricted");
  } else if (status?.premiumEnabled && status.paidThrough) {
    const date = new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium" })
      .format(new Date(status.paidThrough));
    premiumLabel = t("premium.active", { date });
  } else if (status?.entitled) {
    premiumLabel = t("mobileAccount.premiumUnavailable");
  } else if (status?.membershipExpired) {
    premiumLabel = t("mobileAccount.premiumExpired");
  } else if (status) {
    premiumLabel = status.membershipExpired === false
      ? t("mobileAccount.premiumFree")
      : t("premium.inactive");
  }

  return (
    <View style={styles.card}>
      <View style={styles.field}>
        <Text accessibilityRole="header" style={styles.email}>{t("premium.title")}</Text>
        {premium.isPending ? (
          <ActivityIndicator accessibilityLabel={t("mobileAccount.loadingPremium")} color={colors.accent} />
        ) : null}
        {premiumLabel ? <Text style={styles.label}>{premiumLabel}</Text> : null}
        {premium.isError ? (
          <Text accessibilityRole="alert" style={styles.error}>{t("premium.loadFailed")}</Text>
        ) : null}
      </View>
      <View style={styles.field}>
        <Text accessibilityRole="header" style={styles.email}>{t("credits.available")}</Text>
        {credits.isPending ? (
          <ActivityIndicator accessibilityLabel={t("mobileAccount.loadingCredits")} color={colors.accent} />
        ) : null}
        {credits.data ? (
          <Text style={styles.label}>
            {new Intl.NumberFormat(i18n.language).format(credits.data.availableCredits)}
          </Text>
        ) : null}
        {credits.isError ? (
          <Text accessibilityRole="alert" style={styles.error}>{t("mobileAccount.creditsLoadFailed")}</Text>
        ) : null}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ busy: refreshing, disabled: refreshing }}
        disabled={refreshing}
        onPress={() => void Promise.all([premium.refetch(), credits.refetch()])}
        style={({ pressed }) => [styles.signOutButton, (pressed || refreshing) && styles.pressed]}
      >
        <Text style={styles.signOutText}>{t("mobileAccount.refreshStatus")}</Text>
      </Pressable>
    </View>
  );
}

function ProfileSettings({ userId, email }: { userId: number; email: string }) {
  const { colors } = useThemeColors();
  const styles = createStyles(colors);
  const { t } = useTranslation();
  const apiClient = useApiClient();
  const queryClient = useQueryClient();
  const queryKey = ["account-profile", userId] as const;
  const profile = useQuery({
    queryKey,
    queryFn: () => apiClient.getAccountProfile()
  });
  const [draft, setDraft] = useState<string | null>(null);
  const [invalidUsername, setInvalidUsername] = useState(false);
  const update = useMutation({
    mutationFn: (input: UpdateAccountProfileInput) => apiClient.updateAccountProfile(input),
    onSuccess: async (saved, input) => {
      await queryClient.cancelQueries({ queryKey });
      queryClient.setQueryData<AccountProfile>(queryKey, (current) =>
        current ? { ...current, ...saved } : current
      );
      if (input.public_username !== undefined) setDraft(null);
    }
  });

  const savedUsername = profile.data?.public_username ?? "";
  const username = draft ?? savedUsername;
  const saveDisabled = update.isPending || username === savedUsername;
  const avatarUrl = profile.data?.isGoogleUser && profile.data.show_google_avatar
    ? profile.data.google_avatar_url
    : null;

  function saveUsername() {
    if (saveDisabled) return;

    const parsed = publicUsernameInputSchema.safeParse(username);
    setInvalidUsername(!parsed.success);
    if (!parsed.success) return;

    Keyboard.dismiss();
    if (parsed.data === savedUsername) {
      setDraft(null);
      return;
    }
    update.mutate({ public_username: parsed.data });
  }

  return (
    <View style={styles.card}>
      <View style={styles.profileHeader}>
        {avatarUrl ? <Image source={avatarUrl} style={styles.avatar} /> : null}
        <View style={styles.identity}>
          <Text style={styles.label}>{t("mobileNav.signedInAs")}</Text>
          <Text selectable style={styles.email}>{profile.data?.email ?? email}</Text>
        </View>
      </View>
      {profile.isPending ? (
        <ActivityIndicator accessibilityLabel={t("mobileAccount.loading")} color={colors.accent} />
      ) : null}
      {profile.isLoadingError ? (
        <View style={styles.field}>
          <Text accessibilityRole="alert" style={styles.error}>{t("accountPage.error")}</Text>
          <Pressable
            accessibilityRole="button"
            disabled={profile.isFetching}
            onPress={() => void profile.refetch()}
            style={styles.signOutButton}
          >
            <Text style={styles.signOutText}>{t("mobileAccount.retry")}</Text>
          </Pressable>
        </View>
      ) : null}
      {profile.data ? (
        <>
          <View style={styles.field}>
            <Text style={styles.label}>{t("publicUsername.label")}</Text>
            <TextInput
              accessibilityLabel={t("publicUsername.label")}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!update.isPending}
              onChangeText={(value) => {
                setDraft(value);
                setInvalidUsername(false);
                if (!update.isIdle) update.reset();
              }}
              onSubmitEditing={saveUsername}
              placeholder={t("publicUsername.placeholder")}
              placeholderTextColor={colors.textMuted}
              returnKeyType="done"
              style={styles.input}
              value={username}
            />
            {invalidUsername ? (
              <Text accessibilityRole="alert" style={styles.error}>
                {t("mobileAccount.usernameRequired")}
              </Text>
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: saveDisabled, busy: update.isPending && update.variables?.public_username !== undefined }}
              disabled={saveDisabled}
              onPress={saveUsername}
              style={({ pressed }) => [styles.saveButton, (pressed || saveDisabled) && styles.pressed]}
            >
              <Text style={styles.saveText}>{t("mobileAccount.saveUsername")}</Text>
            </Pressable>
            {update.variables?.public_username !== undefined ? (
              <ProfileUpdateFeedback success={update.isSuccess} error={update.isError} setting="username" />
            ) : null}
          </View>
          {profile.data.isGoogleUser ? (
            <View style={styles.field}>
              <View style={styles.avatarSetting}>
                <Text style={[styles.label, styles.identity]}>{t("accountPage.googleAvatar.title")}</Text>
                <Switch
                  accessibilityLabel={t("accountPage.googleAvatar.label")}
                  disabled={update.isPending}
                  onValueChange={(show_google_avatar) => update.mutate({ show_google_avatar })}
                  value={profile.data.show_google_avatar}
                />
              </View>
              <Text style={styles.label}>{t("accountPage.googleAvatar.description")}</Text>
              {update.variables?.show_google_avatar !== undefined ? (
                <ProfileUpdateFeedback success={update.isSuccess} error={update.isError} setting="avatar" />
              ) : null}
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

function ProfileUpdateFeedback({ success, error, setting }: {
  success: boolean;
  error: boolean;
  setting: "username" | "avatar";
}) {
  const { colors } = useThemeColors();
  const styles = createStyles(colors);
  const { t } = useTranslation();
  if (!success && !error) return null;

  return (
    <Text
      accessibilityLiveRegion="polite"
      accessibilityRole={error ? "alert" : undefined}
      style={error ? styles.error : styles.label}
    >
      {error
        ? t(setting === "username" ? "auth.username.error.description" : "auth.avatar.error.description")
        : t(setting === "username" ? "auth.username.success.description" : "auth.avatar.success.description")}
    </Text>
  );
}

function createStyles(colors: typeof colorThemes.light) {
  return StyleSheet.create({
    screen: { backgroundColor: colors.background },
    content: { gap: spacing.lg, padding: spacing.xl },
    accountSections: { gap: spacing.lg },
    card: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.lg,
      borderWidth: 1,
      gap: spacing.lg,
      padding: spacing.lg
    },
    profileHeader: { flexDirection: "row", alignItems: "center", gap: spacing.md },
    identity: { flex: 1, gap: spacing.xs },
    avatar: { width: 48, height: 48, borderRadius: 24 },
    avatarSetting: { flexDirection: "row", alignItems: "center", gap: spacing.md },
    field: { gap: spacing.sm },
    label: { color: colors.textMuted, fontSize: typography.size.caption },
    error: { color: colors.error, fontSize: typography.size.caption },
    input: {
      borderColor: colors.border,
      borderRadius: radii.md,
      borderWidth: 1,
      color: colors.text,
      fontSize: typography.size.body,
      minHeight: 44,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm
    },
    saveButton: {
      alignItems: "center",
      backgroundColor: colors.accent,
      borderRadius: radii.md,
      justifyContent: "center",
      minHeight: 44,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm
    },
    saveText: { color: colors.onAccent, fontSize: typography.size.body, fontWeight: typography.weight.bold },
    email: {
      color: colors.text,
      fontSize: typography.size.action,
      fontWeight: typography.weight.bold
    },
    signOutButton: {
      alignItems: "center",
      borderColor: colors.border,
      borderRadius: radii.md,
      borderWidth: 1,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md
    },
    pressed: { opacity: 0.7 },
    signOutText: {
      color: colors.text,
      fontSize: typography.size.body,
      fontWeight: typography.weight.bold
    },
    version: {
      color: colors.textMuted,
      fontSize: typography.size.caption,
      textAlign: "center"
    }
  });
}

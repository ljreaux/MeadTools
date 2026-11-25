import { useEffect, useRef, useState } from "react";
import { randomUUID } from "expo-crypto";
import { Directory, File, Paths } from "expo-file-system";
import { useNavigation } from "expo-router";
import { ActivityIndicator, Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { spacing } from "@meadtools/design-tokens";

import { useRecipeStyles } from "@/components/recipe-view";
import { useApiClient } from "@/providers/app-providers";

type PdfAction = "view" | "share" | "print";
const labels = {
  view: "mobileRecipes.viewPdf",
  share: "mobileRecipes.sharePdf",
  print: "mobileRecipes.printPdf"
} as const;
const errorLabels = {
  view: "PDF.previewErrorTitle",
  share: "mobileRecipes.sharePdfError",
  print: "mobileRecipes.printPdfError"
} as const;

type PdfPreview = {
  Renderer: typeof import("react-native-pdf-renderer").default;
  directory: Directory;
  uri: string;
};

function removePdf(directory: Directory | undefined) {
  try {
    if (directory?.exists) directory.delete();
  } catch {
    // The OS can purge the app cache if native cleanup fails.
  }
}

export function RecipePdfActions({ recipeId }: { recipeId: number }) {
  const { t, i18n } = useTranslation();
  const { colors, styles } = useRecipeStyles();
  const api = useApiClient();
  const navigation = useNavigation();
  const busy = useRef(false);
  const [running, setRunning] = useState<PdfAction | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [preview, setPreview] = useState<PdfPreview | null>(null);

  useEffect(() => {
    if (preview) return () => removePdf(preview.directory);
  }, [preview]);

  if (Platform.OS !== "ios" && Platform.OS !== "android") return null;

  async function run(action: PdfAction) {
    if (busy.current) return;
    busy.current = true;
    setRunning(action);
    setMessage(null);
    let directory: Directory | undefined;
    let pdfReady = false;
    let retainFile = false;

    try {
      const language = i18n.resolvedLanguage ?? i18n.language;
      const locale = language.toLowerCase().split("-")[0] === "de" ? "de" : "en";
      const { filename, base64 } = await api.getRecipePdf(recipeId, locale);
      if (!navigation.isFocused()) return;
      pdfReady = true;

      const androidPrint = action === "print" && Platform.OS === "android";
      directory = new Directory(Paths.cache, androidPrint ? "recipe-android-print" : `recipe-pdf-${randomUUID()}`);
      // Keep at most one Android print file. The system reads it after the
      // native call returns, so replace it on the next print, not at handoff.
      if (androidPrint && directory.exists) directory.delete();
      directory.create();
      const file = new File(directory, filename);
      file.write(base64, { encoding: "base64" });
      if (action === "view") {
        const { default: Renderer } = await import("react-native-pdf-renderer");
        if (navigation.isFocused()) {
          setPreview({ Renderer, directory, uri: file.uri });
          retainFile = true;
        }
      } else if (action === "print") {
        const { printAsync } = await import("expo-print");
        if (navigation.isFocused()) {
          await printAsync({ uri: file.uri });
          retainFile = androidPrint;
        }
      } else {
        const { isAvailableAsync, shareAsync } = await import("expo-sharing");
        if (!await isAvailableAsync()) {
          setMessage("mobileRecipes.sharePdfUnavailable");
          return;
        }
        if (navigation.isFocused()) {
          await shareAsync(file.uri, { mimeType: "application/pdf", UTI: "com.adobe.pdf" });
        }
      }
    } catch (error) {
      const code = error && typeof error === "object" && "code" in error ? error.code : null;
      // iOS reports dismissing the print sheet without printing as incomplete.
      if (action !== "print" || code !== "ERR_PRINT_INCOMPLETE") {
        setMessage(pdfReady ? errorLabels[action] : "PDF.downloadErrorTitle");
      }
    } finally {
      if (!retainFile) removePdf(directory);
      busy.current = false;
      setRunning(null);
    }
  }

  return (
    <View>
      <View style={pdfStyles.actions}>
        {(["view", "share", "print"] as const).map((action) => (
          <Pressable
            key={action}
            accessibilityRole="button"
            accessibilityState={{ busy: running === action, disabled: running !== null }}
            disabled={running !== null}
            onPress={() => void run(action)}
            style={[styles.action, pdfStyles.button]}
          >
            {running === action ? <ActivityIndicator color={colors.accent} /> : null}
            <Text style={[styles.heading, { color: running ? colors.textMuted : colors.accent }]}>
              {t(labels[action])}
            </Text>
          </Pressable>
        ))}
      </View>
      {message ? <Text accessibilityRole="alert" style={styles.body}>{t(message)}</Text> : null}
      {preview ? (
        <Modal animationType="slide" onRequestClose={() => setPreview(null)}>
          <SafeAreaProvider>
            <SafeAreaView style={[pdfStyles.viewer, { backgroundColor: colors.background }]}>
              <View style={pdfStyles.toolbar}>
                <Text accessibilityRole="header" style={styles.title}>{t("PDF.title")}</Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setPreview(null)}
                  style={[styles.action, pdfStyles.close]}
                >
                  <Text style={[styles.heading, { color: colors.accent }]}>{t("PDF.closePreview")}</Text>
                </Pressable>
              </View>
              <preview.Renderer
                source={preview.uri}
                style={[pdfStyles.viewer, { backgroundColor: colors.surface }]}
                distanceBetweenPages={spacing.md}
                onError={() => {
                  setPreview(null);
                  setMessage(errorLabels.view);
                }}
              />
            </SafeAreaView>
          </SafeAreaProvider>
        </Modal>
      ) : null}
    </View>
  );
}

const pdfStyles = StyleSheet.create({
  actions: { flexDirection: "row", flexWrap: "wrap", columnGap: spacing.lg },
  button: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  viewer: { flex: 1 },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg
  },
  close: { justifyContent: "center" }
});

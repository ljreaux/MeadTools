"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import PrintableIframe from "./PrintableIframe";
import {
  createRecipePdfDefinition,
  getRecipePdfFilename
} from "./recipePdfDefinition";
import { createRecipePdfModel } from "./recipePdfModel";

import { useRecipe } from "@/components/providers/RecipeProvider";
import { useNutrients } from "@/components/providers/NutrientProvider";
import { useToast } from "@/hooks/use-toast";

type Props = {
  // optional metadata you likely have from the saved recipe record
  title?: string;
  publicUsername?: string;
};

type PdfGenerationState =
  | { status: "generating" }
  | { status: "ready"; url: string }
  | { status: "error" };

let logoDataUrlPromise: Promise<string> | undefined;

function loadPdfLogo(): Promise<string> {
  if (logoDataUrlPromise) return logoDataUrlPromise;

  logoDataUrlPromise = fetch("/pdf-logo.png")
    .then((response) => {
      if (!response.ok) throw new Error("Failed to load the PDF logo.");
      return response.blob();
    })
    .then(
      (blob) =>
        new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(blob);
        })
    )
    .catch((error) => {
      logoDataUrlPromise = undefined;
      throw error;
    });

  return logoDataUrlPromise;
}

export default function RecipePdf({ title, publicUsername }: Props) {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const recipe = useRecipe();
  const nutrients = useNutrients();
  const [generationState, setGenerationState] = useState<PdfGenerationState>({
    status: "generating"
  });
  const [retryKey, setRetryKey] = useState(0);
  const pdfUrlRef = useRef<string | null>(null);

  const yeast = useMemo(() => {
    const yeastList = nutrients.catalog.yeastList ?? [];
    const sel = nutrients.data.selected;

    return (
      (sel.yeastId != null
        ? {
            ...yeastList.find((y: any) => y.id === sel.yeastId),
            name: sel.yeastStrain
          }
        : undefined) ?? yeastList.find((y: any) => y.name === sel.yeastStrain)
    );
  }, [nutrients.catalog.yeastList, nutrients.data.selected]);

  const model = useMemo(
    () =>
      createRecipePdfModel({
        recipe,
        nutrients,
        yeast,
        title,
        publicUsername,
        t,
        i18n
      }),
    [i18n, nutrients, publicUsername, recipe, t, title, yeast]
  );
  const [modelSnapshot] = useState(model);
  const [downloadFilename] = useState(() => getRecipePdfFilename(title));

  useEffect(() => {
    let cancelled = false;

    const previousUrl = pdfUrlRef.current;
    if (previousUrl) {
      URL.revokeObjectURL(previousUrl);
      pdfUrlRef.current = null;
    }

    async function generatePdf() {
      const [pdfMakeModule, pdfFontsModule, logoDataUrl] = await Promise.all([
        import("pdfmake/build/pdfmake"),
        import("pdfmake/build/vfs_fonts"),
        loadPdfLogo()
      ]);
      const pdfMake = pdfMakeModule.default;
      pdfMake.addVirtualFileSystem(pdfFontsModule.default);

      const definition = createRecipePdfDefinition({
        model: modelSnapshot,
        logoDataUrl
      });
      const blob = await pdfMake.createPdf(definition).getBlob();
      if (cancelled) return;

      const url = URL.createObjectURL(blob);
      pdfUrlRef.current = url;
      setGenerationState({ status: "ready", url });
    }

    void generatePdf().catch((error) => {
      if (cancelled) return;

      console.error("Failed to generate recipe PDF:", error);
      setGenerationState({ status: "error" });
      toast({
        variant: "destructive",
        title: t("PDF.downloadErrorTitle"),
        description: t("PDF.downloadErrorDescription")
      });
    });

    return () => {
      cancelled = true;
    };
  }, [modelSnapshot, retryKey, t, toast]);

  useEffect(
    () => () => {
      if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current);
    },
    []
  );

  return (
    <PrintableIframe
      pdfUrl={
        generationState.status === "ready" ? generationState.url : undefined
      }
      downloadFilename={downloadFilename}
      isGenerating={generationState.status === "generating"}
      hasError={generationState.status === "error"}
      onRetry={() => {
        setGenerationState({ status: "generating" });
        setRetryKey((key) => key + 1);
      }}
    />
  );
}

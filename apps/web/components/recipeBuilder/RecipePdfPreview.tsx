"use client";

import { useEffect, useRef, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import type {
  PDFDocumentLoadingTask,
  PDFDocumentProxy,
  RenderTask
} from "pdfjs-dist";

type Props = {
  pdfUrl: string;
  zoomPercent: number;
};

const LETTER_PAGE_WIDTH = 612;
const PAGE_GUTTER = 32;

function PdfPage({
  document,
  pageNumber,
  scale
}: {
  document: PDFDocumentProxy;
  pageNumber: number;
  scale: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let renderTask: RenderTask | undefined;
    let cancelled = false;

    async function renderPage() {
      const page = await document.getPage(pageNumber);
      if (cancelled || !canvasRef.current) return;

      const canvas = canvasRef.current;
      const viewport = page.getViewport({ scale });
      const outputScale = Math.min(window.devicePixelRatio || 1, 2);

      canvas.width = Math.floor(viewport.width * outputScale);
      canvas.height = Math.floor(viewport.height * outputScale);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;

      renderTask = page.render({
        canvas,
        viewport,
        transform:
          outputScale === 1
            ? undefined
            : [outputScale, 0, 0, outputScale, 0, 0]
      });
      await renderTask.promise;
    }

    void renderPage().catch((error) => {
      if (cancelled || error?.name === "RenderingCancelledException") return;
      console.error(`Failed to render PDF page ${pageNumber}:`, error);
    });

    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [document, pageNumber, scale]);

  return (
    <canvas
      ref={canvasRef}
      className="block bg-white shadow-md"
      aria-label={`PDF page ${pageNumber}`}
    />
  );
}

export default function RecipePdfPreview({ pdfUrl, zoomPercent }: Props) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [document, setDocument] = useState<PDFDocumentProxy>();
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(([entry]) => {
      if (entry) setContainerWidth(entry.contentRect.width);
    });
    observer.observe(container);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    let loadingTask: PDFDocumentLoadingTask | undefined;

    async function loadDocument() {
      const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
        import.meta.url
      ).toString();

      const task = pdfjs.getDocument({ url: pdfUrl });
      loadingTask = task;
      const nextDocument = await task.promise;
      if (cancelled) {
        await task.destroy();
        return;
      }

      setDocument(nextDocument);
      setHasError(false);
    }

    void loadDocument().catch((error) => {
      if (cancelled) return;
      console.error("Failed to load the PDF preview:", error);
      setHasError(true);
    });

    return () => {
      cancelled = true;
      void loadingTask?.destroy();
    };
  }, [pdfUrl]);

  const availableWidth = Math.max(containerWidth - PAGE_GUTTER, 1);
  const fitScale = availableWidth / LETTER_PAGE_WIDTH;
  const scale = Math.max(fitScale * (zoomPercent / 100), 0.1);

  return (
    <div ref={containerRef} className="h-full overflow-auto bg-gray-500">
      {hasError ? (
        <div className="flex h-full flex-col items-center justify-center gap-2 bg-muted p-6 text-center">
          <p className="font-medium">{t("PDF.previewErrorTitle")}</p>
          <p className="text-sm text-muted-foreground">
            {t("PDF.previewErrorDescription")}
          </p>
        </div>
      ) : document && containerWidth > 0 ? (
        <div className="flex min-w-max flex-col items-center gap-4 p-4">
          {Array.from({ length: document.numPages }, (_, index) => (
            <PdfPage
              key={index + 1}
              document={document}
              pageNumber={index + 1}
              scale={scale}
            />
          ))}
        </div>
      ) : (
        <div className="flex h-full items-center justify-center">
          <LoaderCircle className="size-6 animate-spin" />
          <span className="sr-only">{t("PDF.loadingPreview")}</span>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import {
  Download,
  LoaderCircle,
  Maximize2,
  Minimize2,
  Minus,
  Plus
} from "lucide-react";
import { useTranslation } from "react-i18next";
import RecipePdfPreview from "./RecipePdfPreview";

import { Button } from "../ui/button";
import { ButtonGroup } from "../ui/button-group";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText
} from "../ui/input-group";

interface PrintableIframeProps {
  pdfUrl?: string;
  downloadFilename: string;
  isGenerating: boolean;
  hasError: boolean;
  onRetry: () => void;
}

const PrintableIframe: React.FC<PrintableIframeProps> = ({
  pdfUrl,
  downloadFilename,
  isGenerating,
  hasError,
  onRetry
}) => {
  const { t } = useTranslation();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [zoomPercent, setZoomPercent] = useState(100);
  const [zoomInput, setZoomInput] = useState(100);
  const fullscreenLabel = isFullscreen
    ? t("PDF.exitFullscreen")
    : t("PDF.enterFullscreen");

  const setBoundedZoom = (value: number) => {
    const bounded = Math.min(Math.max(value, 25), 300);
    setZoomPercent(bounded);
    setZoomInput(bounded);
  };

  return (
    <div
      className={
        isFullscreen
          ? "fixed inset-0 z-[100001] flex h-[100dvh] w-screen flex-col bg-background"
          : "relative my-4 flex h-96 w-full flex-col overflow-hidden rounded-sm border border-gray-300"
      }
      aria-busy={isGenerating}
    >
      <div className="flex shrink-0 justify-end border-b bg-background p-1">
        <ButtonGroup className="flex min-w-0 flex-nowrap">
          <Button
            type="button"
            onClick={() => setBoundedZoom(zoomPercent - 10)}
            variant="secondary"
            size="icon"
            aria-label={t("PDF.zoomOut")}
            disabled={!pdfUrl}
          >
            <Minus />
          </Button>

          <InputGroup className="h-9 w-20 rounded-none bg-background">
            <InputGroupInput
              value={zoomInput}
              onChange={(event) => {
                const value = Number.parseInt(event.target.value, 10);
                if (!Number.isNaN(value)) setZoomInput(value);
              }}
              onBlur={() => setBoundedZoom(zoomInput)}
              onKeyDown={(event) => {
                if (event.key === "Enter") setBoundedZoom(zoomInput);
              }}
              inputMode="numeric"
              className="h-full min-w-0 text-center text-sm"
              aria-label={t("PDF.zoomPercent")}
              disabled={!pdfUrl}
            />
            <InputGroupAddon align="inline-end" className="pr-2">
              <InputGroupText>%</InputGroupText>
            </InputGroupAddon>
          </InputGroup>

          <Button
            type="button"
            onClick={() => setBoundedZoom(zoomPercent + 10)}
            variant="secondary"
            size="icon"
            aria-label={t("PDF.zoomIn")}
            disabled={!pdfUrl}
          >
            <Plus />
          </Button>

          <Button
            type="button"
            onClick={() => setIsFullscreen((fullscreen) => !fullscreen)}
            variant="secondary"
            size="icon"
            aria-label={fullscreenLabel}
            aria-pressed={isFullscreen}
            title={fullscreenLabel}
          >
            {isFullscreen ? <Minimize2 /> : <Maximize2 />}
          </Button>

          {pdfUrl ? (
            <Button
              asChild
              variant="secondary"
              size="icon"
              className="joyride-downloadPdf"
            >
              <a
                href={pdfUrl}
                download={downloadFilename}
                aria-label={t("PDF.download")}
                title={t("PDF.download")}
              >
                <Download />
              </a>
            </Button>
          ) : (
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="joyride-downloadPdf"
              aria-label={
                isGenerating ? t("PDF.generating") : t("PDF.download")
              }
              disabled
              title={isGenerating ? t("PDF.generating") : t("PDF.download")}
            >
              {isGenerating ? (
                <LoaderCircle className="animate-spin" />
              ) : (
                <Download />
              )}
            </Button>
          )}
        </ButtonGroup>
      </div>

      <div className="relative min-h-0 flex-1 bg-gray-500">
        {pdfUrl ? (
          <RecipePdfPreview pdfUrl={pdfUrl} zoomPercent={zoomPercent} />
        ) : (
          <div
            className="flex h-full flex-col items-center justify-center gap-3 bg-muted p-6 text-center"
            role="status"
          >
            {isGenerating ? (
              <>
                <LoaderCircle className="size-6 animate-spin" />
                <p>{t("PDF.generating")}</p>
              </>
            ) : hasError ? (
              <>
                <p className="font-medium">{t("PDF.downloadErrorTitle")}</p>
                <p className="text-sm text-muted-foreground">
                  {t("PDF.downloadErrorDescription")}
                </p>
                <Button type="button" variant="secondary" onClick={onRetry}>
                  {t("PDF.retry")}
                </Button>
              </>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
};

export default PrintableIframe;

"use client";

import { useRef, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { Button } from "../ui/button";
import { ButtonGroup } from "../ui/button-group";
import { Plus, Minus, Download, Maximize2, Minimize2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText
} from "../ui/input-group";

interface PrintableIframeProps {
  content: React.ReactNode;
}

const PrintableIframe: React.FC<PrintableIframeProps> = ({ content }) => {
  const { t } = useTranslation();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [cssContent, setCssContent] = useState<string>("");
  const [zoomFactor, setZoomFactor] = useState<number>(1);
  const [inputValue, setInputValue] = useState<number>(100);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const isMobile = window.matchMedia("(max-width: 640px)").matches;

    if (isMobile) {
      setZoomFactor(0.4);
      setInputValue(40);
    }
  }, []);

  useEffect(() => {
    fetch("/iframe-styles.css")
      .then((res) => res.text())
      .then((css) => setCssContent(css))
      .catch((err) => console.error("Failed to load CSS:", err));
  }, []);

  const injectPreviewContent = () => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const iframeDocument = iframe.contentDocument;
    if (!iframeDocument) return;

    iframeDocument.body.innerHTML = "";

    const container = iframeDocument.createElement("div");
    container.className = "printable-content";
    container.style.transform = `scale(${zoomFactor})`;
    container.style.transformOrigin = "top left";
    iframeDocument.body.appendChild(container);

    const style = iframeDocument.createElement("style");
    style.innerHTML = `${cssContent}\nhtml, body { background-color: gray; }`;
    iframeDocument.head.appendChild(style);

    const root = createRoot(container);
    root.render(<>{content}</>);
  };

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const handleLoad = () => {
      setIframeLoaded(true);
      if (cssContent) injectPreviewContent();
    };

    iframe.addEventListener("load", handleLoad);
    return () => iframe.removeEventListener("load", handleLoad);
  }, [cssContent]);

  useEffect(() => {
    if (iframeLoaded && cssContent) injectPreviewContent();
  }, [content, iframeLoaded, cssContent, zoomFactor]);

  const handlePrint = () => {
    if (!cssContent) {
      console.warn("CSS not loaded yet. Printing without styles.");
    }

    const printableHTML = renderToString(<>{content}</>);

    const newWindow = window.open("", "_blank", "width=800,height=600");
    if (!newWindow) return;

    newWindow.document.open();
    newWindow.document.write(`
      <html>
        <head>
          <style>${cssContent}</style>
        </head>
        <body>
          ${printableHTML}
        </body>
      </html>
    `);
    newWindow.document.close();

    setTimeout(() => {
      newWindow.focus();
      newWindow.print();
    }, 100);
  };

  const handleZoomIn = () => {
    const newZoom = Math.min(zoomFactor + 0.1, 3);
    setZoomFactor(newZoom);
    setInputValue(Math.round(newZoom * 100));
  };

  const handleZoomOut = () => {
    const newZoom = Math.max(zoomFactor - 0.1, 0.1);
    setZoomFactor(newZoom);
    setInputValue(Math.round(newZoom * 100));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value)) setInputValue(value);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      const newZoom = Math.max(0.1, Math.min(inputValue / 100, 3));
      setZoomFactor(newZoom);
      setInputValue(Math.round(newZoom * 100));
    }
  };

  return (
    <div
      className={
        isFullscreen
          ? "fixed inset-0 z-[1002] h-[100dvh] w-screen bg-background"
          : "relative my-4 h-96 w-full rounded-sm border border-gray-300"
      }
    >
      <iframe
        ref={iframeRef}
        className="w-full h-full"
        title="MeadTools Recipe PDF"
        srcDoc="<html><head></head><body></body></html>"
      />

      {/* ✅ Wrap EVERYTHING (zoom + download) in a single ButtonGroup so it can’t drop below */}
      <div className="absolute inset-x-1 top-2 sm:right-2 sm:left-auto md:right-10">
        <ButtonGroup className="ml-auto flex w-full flex-nowrap items-center sm:w-fit">
          {/* Nested ButtonGroup: zoom controls */}
          <ButtonGroup className="flex min-w-0 flex-1 flex-nowrap items-center sm:flex-none">
            <Button
              type="button"
              onClick={handleZoomOut}
              variant="secondary"
              className="shrink-0 max-sm:size-8 max-sm:px-0"
              aria-label="Zoom out"
            >
              <Minus className="h-4 w-4" />
            </Button>

            {/* InputGroup in the middle, styled like secondary background */}
            <InputGroup
              className={[
                "h-8 min-w-0 flex-1 sm:h-9 sm:w-auto sm:flex-none",
                "bg-background dark:bg-background",
                "rounded-none"
              ].join(" ")}
            >
              <InputGroupInput
                value={inputValue}
                onChange={handleInputChange}
                onKeyDown={handleInputKeyDown}
                inputMode="numeric"
                className="h-full min-w-0 w-full text-center text-sm sm:w-[4.5rem]"
              />
              <InputGroupAddon
                align="inline-end"
                className="pr-1 sm:pr-2"
              >
                <InputGroupText>%</InputGroupText>
              </InputGroupAddon>
            </InputGroup>

            <Button
              type="button"
              onClick={handleZoomIn}
              variant="secondary"
              className="shrink-0 max-sm:size-8 max-sm:px-0"
              aria-label="Zoom in"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </ButtonGroup>

          <ButtonGroup className="shrink-0">
            <Button
              type="button"
              onClick={() => setIsFullscreen((fullscreen) => !fullscreen)}
              variant="secondary"
              className="max-sm:size-8 max-sm:px-0"
              aria-label={
                isFullscreen
                  ? t("PDF.exitFullscreen")
                  : t("PDF.enterFullscreen")
              }
              aria-pressed={isFullscreen}
              title={
                isFullscreen
                  ? t("PDF.exitFullscreen")
                  : t("PDF.enterFullscreen")
              }
            >
              {isFullscreen ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </Button>
          </ButtonGroup>

          <ButtonGroup className="shrink-0">
            <Button
              type="button"
              onClick={handlePrint}
              variant="secondary"
              className="joyride-downloadPdf max-sm:size-8 max-sm:px-0"
              aria-label="Download / Print"
            >
              <Download className="h-4 w-4" />
            </Button>
          </ButtonGroup>
        </ButtonGroup>
      </div>
    </div>
  );
};

export default PrintableIframe;

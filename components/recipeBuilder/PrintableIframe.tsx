"use client";

import { useRef, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { Button } from "../ui/button";
import { ButtonGroup } from "../ui/button-group";
import { Plus, Minus, Download } from "lucide-react";

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
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [cssContent, setCssContent] = useState<string>("");
  const [zoomFactor, setZoomFactor] = useState<number>(1);
  const [inputValue, setInputValue] = useState<number>(100);

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
    <div className="relative w-full my-4 border border-gray-300 rounded-sm h-96">
      <iframe
        ref={iframeRef}
        className="w-full h-full"
        title="MeadTools Recipe PDF"
        srcDoc="<html><head></head><body></body></html>"
      />

      {/* ✅ Wrap EVERYTHING (zoom + download) in a single ButtonGroup so it can’t drop below */}
      <div className="absolute right-1 sm:right-2 top-2 md:right-10">
        <ButtonGroup className="flex flex-nowrap items-center">
          {/* Nested ButtonGroup: zoom controls */}
          <ButtonGroup className="flex flex-nowrap items-center">
            <Button
              type="button"
              onClick={handleZoomOut}
              variant="secondary"
              aria-label="Zoom out"
            >
              <Minus className="h-4 w-4" />
            </Button>

            {/* InputGroup in the middle, styled like secondary background */}
            <InputGroup
              className={[
                "w-auto",
                "bg-background dark:bg-background",
                "rounded-none"
              ].join(" ")}
            >
              <InputGroupInput
                value={inputValue}
                onChange={handleInputChange}
                onKeyDown={handleInputKeyDown}
                inputMode="numeric"
                className="h-full w-[4.5rem] text-center text-sm"
              />
              <InputGroupAddon align="inline-end" className="pr-2">
                <InputGroupText>%</InputGroupText>
              </InputGroupAddon>
            </InputGroup>

            <Button
              type="button"
              onClick={handleZoomIn}
              variant="secondary"
              aria-label="Zoom in"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </ButtonGroup>

          <ButtonGroup>
            <Button
              type="button"
              onClick={handlePrint}
              variant="secondary"
              className="joyride-downloadPdf"
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

"use client";

import { useEffect, useState } from "react";
import { Info } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "./ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider
} from "./ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

type TooltipHelperProps = {
  body: string;
  link?: string;
  links?: string[][];
};

export default function TooltipHelper({
  body,
  link,
  links
}: TooltipHelperProps) {
  const { t } = useTranslation();
  const [isTouch, setIsTouch] = useState(false);

  // Detect coarse pointer (touch-ish devices)
  useEffect(() => {
    if (typeof window === "undefined") return;

    const isCoarse =
      window.matchMedia && window.matchMedia("(pointer: coarse)").matches;

    setIsTouch(isCoarse);
  }, []);

  const content = (
    <div className="max-w-xs text-sm space-y-2">
      {/* body + primary link inline */}
      <p>
        {body}
        {link && (
          <>
            {" "}
            <a
              href={link}
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              {t("tipText.linkText")}
            </a>
          </>
        )}
      </p>

      {/* additional links below, one per line */}
      {links && links.length > 0 && (
        <div className="space-y-1">
          {links.map(([href, label]) => (
            <a
              key={href}
              href={href}
              target="_blank"
              rel="noreferrer"
              className="underline block"
            >
              {label}
            </a>
          ))}
        </div>
      )}
    </div>
  );

  const trigger = (
    <Button
      variant="ghost"
      aria-label={t("tipText.ariaLabel", { defaultValue: "More info" })}
      className="p-1 h-fit mx-1"
    >
      <Info className="w-4 h-4" />
    </Button>
  );

  // 📱 Mobile / touch: Popover (tap to open)
  if (isTouch) {
    return (
      <Popover>
        <PopoverTrigger asChild>{trigger}</PopoverTrigger>
        <PopoverContent className="max-w-xs">{content}</PopoverContent>
      </Popover>
    );
  }

  // 🖥️ Desktop: Tooltip (hover/focus)
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>{trigger}</TooltipTrigger>
        <TooltipContent>{content}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

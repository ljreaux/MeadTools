import { Info } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider
} from "./ui/tooltip";
import { Button } from "./ui/button";

export default function TooltipHelper({
  body,
  link,
  links
}: {
  body: string;
  link?: string;
  links?: string[][];
}) {
  const { t } = useTranslation();

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            aria-label="More info"
            className="p-1 h-fit mx-1"
          >
            <Info className="w-4 h-4" />
          </Button>
        </TooltipTrigger>

        <TooltipContent className="space-y-2 max-w-xs leading-snug text-sm">
          {/* Body + inline link */}
          <p>
            {body}{" "}
            {link && (
              <a href={link} target="_blank" className="underline">
                {t("tipText.linkText")}
              </a>
            )}
          </p>

          {/* Extra links below the paragraph */}
          {links && links.length > 0 && (
            <div className="space-y-1">
              {links.map(([href, label]) => (
                <a
                  key={href}
                  href={href}
                  target="_blank"
                  className="underline block text-sm"
                >
                  {label}
                </a>
              ))}
            </div>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

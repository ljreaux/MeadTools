import { cn } from "@/lib/utils";
import { normalizeNumberString } from "@/lib/utils/validateInput";
import { useTranslation } from "react-i18next";
import { Separator } from "@/components/ui/separator";

export default function AbvLine({
  ABV,
  delle,
  textSize
}: {
  ABV: number;
  delle: number;
  textSize?: string;
}) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage;

  const abvDisplay = normalizeNumberString(ABV, 2, locale);
  const delleDisplay = normalizeNumberString(delle, 0, locale);

  return (
    <div
      className={cn(
        "w-full max-w-3xl mx-auto flex items-center rounded-md p-2",
        {
          "bg-destructive": Number(abvDisplay) < 0 || Number(abvDisplay) > 23
        }
      )}
    >
      {/* Left side – grows, but text hugs the separator */}
      <div className="flex-1 flex justify-end">
        <div className="text-center mr-3">
          <p
            className={cn(textSize || "text-3xl font-semibold tracking-tight")}
          >
            {abvDisplay}%
          </p>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {t("ABV")}
          </p>
        </div>
      </div>

      {/* Center separator – naturally in the middle because of flex-1 wings */}
      <Separator orientation="vertical" className="h-8" />

      {/* Right side – grows, but text hugs the separator */}
      <div className="flex-1 flex justify-start">
        <div className="text-center ml-3">
          <p className={cn(textSize || "text-2xl font-medium tracking-tight")}>
            {delleDisplay}
          </p>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {t("DU")}
          </p>
        </div>
      </div>
    </div>
  );
}

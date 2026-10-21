"use client";

import { Check, Palette } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { useDesignTheme } from "@/hooks/useDesignTheme";
import { DESIGN_THEMES } from "@/lib/design-themes";

export function DesignThemeSwitcher() {
  const { design, setDesign } = useDesignTheme();
  const { t } = useTranslation();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="secondary"
          size="icon"
          className="p-2"
        >
          <Palette className="h-[1.2rem] w-[1.2rem]" />
          <span className="sr-only">
            {t("accountPage.designTheme.toggle")}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{t("accountPage.designTheme.title")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {DESIGN_THEMES.map((theme) => (
          <DropdownMenuItem
            key={theme.id}
            onClick={() => setDesign(theme.id)}
            className="justify-between gap-4"
          >
            {t(`accountPage.designTheme.${theme.id}`)}
            {design === theme.id && <Check className="h-4 w-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

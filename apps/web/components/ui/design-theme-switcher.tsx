"use client";

import { Palette } from "lucide-react";
import { useTheme } from "next-themes";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDesignTheme } from "@/hooks/useDesignTheme";
import { DESIGN_THEMES, isDesignThemeId } from "@/lib/design-themes";

export function DesignThemeSwitcher() {
  const { design, setDesign } = useDesignTheme();
  const { theme: mode, setTheme: setMode } = useTheme();
  const { t } = useTranslation();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" size="icon" className="p-2">
          <Palette className="h-[1.2rem] w-[1.2rem]" />
          <span className="sr-only">{t("accountPage.designTheme.toggle")}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>
          {t("accountPage.designTheme.title")}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={design}
          onValueChange={(value) => {
            if (isDesignThemeId(value)) setDesign(value);
          }}
        >
          {DESIGN_THEMES.map(({ id }) => (
            <DropdownMenuRadioItem key={id} value={id}>
              {t(`accountPage.designTheme.${id}`)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>{t("accountPage.theme.title")}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={mode} onValueChange={setMode}>
          {["light", "dark", "system"].map((value) => (
            <DropdownMenuRadioItem key={value} value={value}>
              {t(`accountPage.theme.${value}`)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

"use client";

import { Switch } from "../ui/switch";
import { useTranslation } from "react-i18next";
import Tooltip from "../Tooltips";
import {
  Select,
  SelectContent,
  SelectTrigger,
  SelectValue,
  SelectItem
} from "../ui/select";
import {
  InputGroup,
  InputGroupInput,
  InputGroupAddon
} from "@/components/ui/input-group";
import { Separator } from "../ui/separator";
import { normalizeNumberString } from "@/lib/utils/validateInput";
import { useRecipeV2 } from "../providers/RecipeProviderV2";

export default function StabilizersV2() {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage;

  const { stabilizers } = useRecipeV2();
  const {
    addingStabilizers,
    toggleStabilizers,
    takingPh,
    toggleTakingPh,
    phReading,
    updatePhReading,
    sorbate,
    sulfite,
    campden,
    stabilizerType,
    setStabilizerType
  } = stabilizers;

  // Display values (match standalone calc style)
  const sorbateDisplay = normalizeNumberString(sorbate, 3, locale);
  const sulfiteDisplay = normalizeNumberString(sulfite, 3, locale);
  const campdenDisplay = normalizeNumberString(
    Math.round(campden * 10) / 10,
    1,
    locale
  );

  return (
    <div className="joyride-stabilizersCard py-6">
      {/* Top row: "Adding stabilizers" toggle */}
      <div className="flex items-center justify-between mb-4">
        <label className="flex items-center gap-2 text-sm font-medium">
          {t("adding")}
          <Switch
            checked={addingStabilizers}
            onCheckedChange={toggleStabilizers}
          />
        </label>
      </div>

      {addingStabilizers && (
        <div className="space-y-6">
          {/* pH section */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-4 min-h-12">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{t("pH")}</span>
                <Switch checked={takingPh} onCheckedChange={toggleTakingPh} />
              </div>

              {takingPh && (
                <div>
                  <InputGroup className="h-12">
                    <InputGroupInput
                      inputMode="decimal"
                      type="text"
                      onFocus={(e) => e.target.select()}
                      value={phReading}
                      onChange={(e) => updatePhReading(e.target.value)}
                      disabled={!takingPh}
                      className="h-full text-lg"
                    />
                    <InputGroupAddon
                      className="px-2 text-xs sm:text-sm"
                      align="inline-end"
                    >
                      pH
                    </InputGroupAddon>
                  </InputGroup>
                </div>
              )}
            </div>
          </div>

          <Separator className="my-2" />

          {/* Results */}
          <div className="space-y-4">
            <h3 className="text-base font-semibold">{t("results")}</h3>

            {/* Sorbate line */}
            <div className="flex justify-center">
              {sorbate > 0 ? (
                <div className="text-center">
                  <p className="text-2xl font-medium tracking-tight">
                    {sorbateDisplay}
                    <span className="ml-1 text-lg text-muted-foreground">
                      g
                    </span>
                  </p>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {t("kSorbate")}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{t("noSorb")}</p>
              )}
            </div>

            {sorbate > 0 && (
              <>
                {/* AND between sorbate + sulfite/campden */}
                <p className="text-xs uppercase tracking-wide text-muted-foreground text-center">
                  {t("AND")}
                </p>

                {/* Sulfite / Campden row */}
                <div className="w-full max-w-3xl mx-auto">
                  <div className="flex flex-col sm:flex-row items-center w-full gap-4 sm:gap-6">
                    {/* Left: grams of sulfite with type select */}
                    <div className="flex-1 flex justify-center sm:justify-end">
                      <div className="text-center sm:mr-3 space-y-2">
                        <p className="text-2xl font-medium tracking-tight">
                          {sulfiteDisplay}
                          <span className="ml-1 text-lg text-muted-foreground">
                            g
                          </span>
                        </p>

                        <div className="flex items-center justify-center gap-2 text-xs sm:text-sm">
                          <Select
                            value={stabilizerType}
                            onValueChange={(v) =>
                              setStabilizerType(v as "kmeta" | "nameta")
                            }
                          >
                            <SelectTrigger className="h-9 min-w-[120px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="kmeta">
                                {t("kMeta")}
                              </SelectItem>
                              <SelectItem value="nameta">
                                {t("naMeta")}
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>

                    {/* Center "or" */}
                    <p className="text-xs uppercase tracking-wide text-muted-foreground text-center">
                      {t("accountPage.or")}
                    </p>

                    {/* Right: campden tablets */}
                    <div className="flex-1 flex justify-center sm:justify-start">
                      <div className="text-center sm:ml-3 space-y-1">
                        <p className="text-2xl font-medium tracking-tight">
                          {campdenDisplay}
                        </p>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground flex items-center justify-center gap-1">
                          {t("campden")}
                          <Tooltip body={t("tipText.campden")} />
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

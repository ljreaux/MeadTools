"use client";

import {
  InputGroup,
  InputGroupInput,
  InputGroupAddon
} from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import usePrimingSugar from "@/hooks/usePrimingSugar";
import PrimingSugarTable from "@/components/extraCalcs/PrimingSugarTable";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { PrimingSugarSkeleton } from "@/components/extraCalcs/PrimingSugarSkeleton";

function PrimingSugar() {
  const { t } = useTranslation();
  const {
    tempProps,
    tempUnitProps,
    volsProps,
    volumeProps,
    volumeUnitProps,
    primingSugarAmounts,
    tempInvalid,
    volsInvalid,
    ingredientsLoading
  } = usePrimingSugar();

  return (
    <div className="flex flex-col gap-8 h-full w-full max-w-3xl mx-auto">
      {/* Heading */}
      <h1 className="sm:text-3xl text-xl text-center text-foreground">
        {t("primingSugarHeading")}
      </h1>

      {/* Inputs */}
      <div className="flex flex-col gap-6">
        {/* Temperature + units */}
        <div className="space-y-2 relative">
          <label htmlFor="temp" className="text-sm font-medium">
            {t("enterTemp")}
          </label>

          <InputGroup className="h-12">
            <InputGroupInput
              id="temp"
              type="number"
              {...tempProps}
              aria-invalid={tempInvalid || undefined}
              onFocus={(e) => e.target.select()}
              className="h-full text-lg"
            />
            <InputGroupAddon
              align="inline-end"
              className="px-1 text-xs sm:text-sm whitespace-nowrap mr-1"
            >
              <Separator orientation="vertical" className="h-12" />
              <Select {...tempUnitProps}>
                <SelectTrigger className="p-2 border-none mr-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="C">C</SelectItem>
                  <SelectItem value="F">F</SelectItem>
                </SelectContent>
              </Select>
            </InputGroupAddon>
          </InputGroup>

          {/* Absolutely positioned error text – matches refractometer pattern */}
          <p
            className={cn(
              "absolute top-full left-0 text-xs text-destructive",
              !tempInvalid && "invisible"
            )}
          >
            {t("tempInvalid")}
          </p>
        </div>

        {/* Desired CO2 volumes */}
        <div className="space-y-2 relative">
          <label htmlFor="co2Vol" className="text-sm font-medium">
            {t("co2Vol")}
          </label>

          <InputGroup className="h-12">
            <InputGroupInput
              id="co2Vol"
              type="number"
              {...volsProps}
              aria-invalid={volsInvalid || undefined}
              onFocus={(e) => e.target.select()}
              className="h-full text-lg"
            />
          </InputGroup>

          <p
            className={cn(
              "absolute top-full left-0 text-xs text-destructive",
              !volsInvalid && "invisible"
            )}
          >
            {t("volInvalid")}
          </p>
        </div>

        {/* Brew volume + units */}
        <div className="space-y-2">
          <label htmlFor="brewVolume" className="text-sm font-medium">
            {t("brewVolume")}
          </label>

          <InputGroup className="h-12">
            <InputGroupInput
              id="brewVolume"
              type="number"
              {...volumeProps}
              onFocus={(e) => e.target.select()}
              className="h-full text-lg"
            />
            <InputGroupAddon
              align="inline-end"
              className="px-1 text-xs sm:text-sm whitespace-nowrap mr-1"
            >
              <Separator orientation="vertical" className="h-12" />
              <Select {...volumeUnitProps}>
                <SelectTrigger className="p-2 border-none mr-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gal">{t("GAL")}</SelectItem>
                  <SelectItem value="lit">{t("LIT")}</SelectItem>
                </SelectContent>
              </Select>
            </InputGroupAddon>
          </InputGroup>
        </div>
      </div>

      {/* Divider between form + table */}
      <Separator className="my-2" />

      {/* Table / Skeleton */}
      {ingredientsLoading ? (
        <PrimingSugarSkeleton />
      ) : (
        <PrimingSugarTable primingSugar={primingSugarAmounts} />
      )}
    </div>
  );
}

export default PrimingSugar;

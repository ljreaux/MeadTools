"use client";
import AbvLine from "@/components/extraCalcs/AbvLine";
import Tooltip from "@/components/Tooltips";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import useAbv from "@/hooks/useAbv";
import useRefrac from "@/hooks/useRefrac";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

function RefractometerCorrection() {
  const { t, i18n } = useTranslation();
  const currentLocale = i18n.resolvedLanguage;
  const {
    correctionFactorProps,
    ogProps,
    ogUnitProps,
    fgProps,
    fgUnitProps,
    correctedFg,
    correctedBrix,
  } = useRefrac();
  const abv = useAbv(ogProps.value, correctedFg.toString());

  const warn = correctionFactorProps.value !== "1";

  return (
    <>
      <h1 className="sm:text-3xl text-xl text-center text-foreground">
        {t("refractometerHeading")}
      </h1>
      <Table>
        <TableBody>
          <TableRow className={cn(warn && "bg-[rgb(255,204,0)] text-black")}>
            <TableCell className={cn(warn ? "text-black" : "text-foreground")}>
              <span className="flex items-center">
                {t("correctionFactor")}
                <Tooltip
                  body={t("tiptext.refractometerWarning")}
                  link="https://www.brewersfriend.com/how-to-determine-your-refractometers-wort-correction-factor/"
                />
              </span>
            </TableCell>
            <TableCell colSpan={2}>
              <Input
                inputMode="decimal"
                name="cf"
                id="cf"
                {...correctionFactorProps}
                onFocus={(e) => e.target.select()}
              />
            </TableCell>
          </TableRow>
          <TableRow>
            <TableCell>{t("ogLabel")} </TableCell>
            <TableCell className="p-1 md:p-4">
              <Select name="units" {...ogUnitProps}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SG">{t("SG")}</SelectItem>
                  <SelectItem value="Brix">{t("BRIX")}</SelectItem>
                </SelectContent>
              </Select>
            </TableCell>
            <TableCell className="p-1 md:p-4">
              <Input
                inputMode="decimal"
                name="og"
                id="og"
                {...ogProps}
                onFocus={(e) => e.target.select()}
              />
            </TableCell>
          </TableRow>
          <TableRow
            className={cn({
              "bg-destructive": fgUnitProps.value === "SG",
            })}
          >
            <TableCell>
              <div className="flex items-center gap-2">
                {t("fgInBrix")}{" "}
                {fgUnitProps.value === "SG" && (
                  <Tooltip body={t("fgWarning")} />
                )}
              </div>
            </TableCell>
            <TableCell className="p-1 md:p-4">
              <Select name="units" {...fgUnitProps}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SG">{t("SG")}</SelectItem>
                  <SelectItem value="Brix">{t("BRIX")}</SelectItem>
                </SelectContent>
              </Select>
            </TableCell>
            <TableCell>
              <span className="flex">
                <Input
                  inputMode="decimal"
                  name="fgInBrix"
                  id="fg"
                  {...fgProps}
                  onFocus={(e) => e.target.select()}
                />
                <span className=" sm:flex grid items-center gap-1 justify-center text-center min-w-fit mx-1">
                  <p>
                    {correctedFg.toLocaleString(currentLocale, {
                      maximumFractionDigits: 3,
                    })}
                  </p>
                  <p className="min-w-fit">{`${correctedBrix.toLocaleString(
                    currentLocale,
                    {
                      maximumFractionDigits: 2,
                    }
                  )} ${t("BRIX")}`}</p>
                </span>
              </span>
            </TableCell>
          </TableRow>
          <TableRow>
            <TableCell colSpan={3}>
              <span className="flex items-center justify-center text-center">
                <AbvLine {...abv} textSize="text-lg" />
              </span>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </>
  );
}

export default RefractometerCorrection;

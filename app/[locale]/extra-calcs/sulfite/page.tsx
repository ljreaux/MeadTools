"use client";
import Tooltip from "@/components/Tooltips";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { isValidNumber, parseNumber } from "@/lib/utils/validateInput";
import { useState } from "react";
import { useTranslation } from "react-i18next";

function Sulfite() {
  const { t, i18n } = useTranslation();
  const currentLocale = i18n.resolvedLanguage;
  const [stabilizerType, setStabilizerType] = useState("kMeta");

  const [sulfite, setSulfite] = useState({
    batchSize: (1).toLocaleString(currentLocale),
    units: "gallons",
    ppm: (50).toLocaleString(currentLocale),
  });
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isValidNumber(e.target.value))
      setSulfite((prev) => ({
        ...prev,
        [e.target.id]: e.target.value,
      }));
  };

  const multiplier = stabilizerType === "kMeta" ? 570 : 674;

  const sulfiteAmount =
    sulfite.units === "gallons"
      ? (parseNumber(sulfite.batchSize) * 3.785 * parseNumber(sulfite.ppm)) /
        multiplier
      : (parseNumber(sulfite.batchSize) * parseNumber(sulfite.ppm)) /
        multiplier;

  const campden =
    sulfite.units !== "gallons"
      ? (parseNumber(sulfite.ppm) / 75) *
        (parseNumber(sulfite.batchSize) / 3.785)
      : (parseNumber(sulfite.ppm) / 75) * parseNumber(sulfite.batchSize);
  return (
    <Table>
      <TableHeader>
        <TableRow className="border-none">
          <TableCell colSpan={3}>
            <h1 className="sm:text-3xl text-xl text-center text-foreground">
              {t("sulfiteHeading")}
            </h1>
          </TableCell>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell>{t("batchSize")} </TableCell>
          <TableCell>
            <Input
              inputMode="decimal"
              id="batchSize"
              onFocus={(e) => e.target.select()}
              onChange={handleChange}
              value={sulfite.batchSize}
            />
          </TableCell>
          <TableCell>
            <Select
              name="units"
              onValueChange={(val) => {
                setSulfite((prev) => ({ ...prev, units: val }));
              }}
              value={sulfite.units}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gallons">{t("GAL")}</SelectItem>
                <SelectItem value="liter">{t("LIT")}</SelectItem>
              </SelectContent>
            </Select>
          </TableCell>
        </TableRow>
        <TableRow>
          <TableCell>{t("desiredPpm")} </TableCell>
          <TableCell colSpan={2}>
            <Input
              inputMode="decimal"
              name="ppm"
              id="ppm"
              onChange={handleChange}
              value={sulfite.ppm}
            />
          </TableCell>
        </TableRow>

        <TableRow>
          <TableCell colSpan={3}>
            <span className="grid items-center justify-center gap-2 sm:text-2xl text-center">
              <div className="flex gap-2">
                {sulfiteAmount.toLocaleString(currentLocale, {
                  maximumFractionDigits: 3,
                })}
                g
                <Select
                  value={stabilizerType}
                  onValueChange={setStabilizerType}
                >
                  <SelectTrigger>
                    <SelectValue></SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="kMeta"> {t("kMeta")}</SelectItem>
                    <SelectItem value="naMeta">{t("naMeta")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p>{t("accountPage.or")}</p>
              <p className="flex item-center justify-center gap-2">
                {campden.toLocaleString(currentLocale)} {t("campden")}
                <Tooltip body={t("tipText.campden")} />
              </p>
            </span>
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}

export default Sulfite;

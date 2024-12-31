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
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";

function Sulfite() {
  const { t } = useTranslation();

  const [sulfite, setSulfite] = useState({
    batchSize: 1,
    units: "gallons",
    ppm: 50,
  });
  const handleChange = (e: FormEvent<EventTarget>) => {
    const target = e.target as HTMLInputElement;
    setSulfite((prev) => ({
      ...prev,
      [target.id]: target.value,
    }));
  };

  const sulfiteAmount =
    sulfite.units === "gallons"
      ? (sulfite.batchSize * 3.785 * sulfite.ppm) / 570
      : (sulfite.batchSize * sulfite.ppm) / 570;

  const campden =
    sulfite.units !== "gallons"
      ? (sulfite.ppm / 75) * (sulfite.batchSize / 3.785)
      : (sulfite.ppm / 75) * sulfite.batchSize;
  return (
    <Table>
      <TableHeader>
        <TableRow className="border-none">
          <TableHead colSpan={3}>
            <h1 className="sm:text-3xl text-xl text-center text-foreground">
              {t("sulfiteHeading")}
            </h1>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableHead>{t("batchSize")} </TableHead>
          <TableCell>
            <Input
              type="number"
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
          <TableHead>{t("desiredPpm")} </TableHead>
          <TableCell colSpan={2}>
            <Input
              type="number"
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
              <p>
                {Math.round(sulfiteAmount * 10000) / 10000}g {t("kMeta")}
              </p>{" "}
              <p>{t("accountPage.or")}</p>{" "}
              <p className="flex item-center justify-center gap-2">
                {Math.round(campden * 10) / 10} {t("list.campden")}
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

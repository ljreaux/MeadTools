"use client";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTranslation } from "react-i18next";

import useStabilizers from "@/hooks/useStabilizers";
import Tooltip from "@/components/Tooltips";

const Stabilizers = () => {
  const {
    setVolume,
    volume,
    volumeUnits,
    setVolumeUnits,
    sorbate,
    sulfite,
    campden,
    phReading,
    setPhReading,
    abv,
    setAbv,
    takingReading,
    setTakingReading,
    stabilizerType,
    setStabilizerType,
  } = useStabilizers();

  const { t } = useTranslation();
  return (
    <div className="w-full flex justify-center items-center sm:pt-24 pt-[6rem] relative">
      <div className="flex flex-col md:p-12 p-8 rounded-xl bg-background gap-4 w-11/12 max-w-[650px]">
        <h1 className="sm:text-3xl text-xl text-center">
          {t("calculators.extraCalcs.stabilizers")}
        </h1>
        <Table>
          <TableHeader>
            <TableRow className="border-none">
              <TableCell>{t("batchSize")}</TableCell>
              <TableCell>{t("UNITS")}:</TableCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>
                <Input
                  value={volume.toString()}
                  onChange={(e) => setVolume(Number(e.target.value))}
                  type="number"
                  step={0.001}
                  onFocus={(e) => e.target.select()}
                />
              </TableCell>
              <TableCell>
                <Select
                  onValueChange={(val) => {
                    setVolumeUnits(val as "gal" | "lit");
                  }}
                  value={volumeUnits}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gal">{t("GAL")}</SelectItem>
                    <SelectItem value="lit">{t("LIT")}</SelectItem>
                  </SelectContent>
                </Select>
              </TableCell>
            </TableRow>
            <TableRow className="border-none">
              <TableCell>{t("ABV")}:</TableCell>
              <TableCell>
                <span className="flex gap-4 py-4 text-center flex-col sm:flex-row">
                  <p>{t("pH")}</p>
                  <Select
                    value={takingReading ? "yes" : "no"}
                    onValueChange={(val) => setTakingReading(val === "yes")}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yes">Yes</SelectItem>
                      <SelectItem value="no">No</SelectItem>
                    </SelectContent>
                  </Select>
                </span>
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell>
                <Input
                  value={abv}
                  onChange={(e) => setAbv(Number(e.target.value))}
                  type="number"
                  step={0.01}
                  onFocus={(e) => e.target.select()}
                />
              </TableCell>
              <TableCell>
                <Input
                  value={phReading}
                  onChange={(e) => setPhReading(Number(e.target.value))}
                  type="number"
                  step={0.01}
                  onFocus={(e) => e.target.select()}
                  disabled={!takingReading}
                />
              </TableCell>
            </TableRow>
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell>
                {sorbate.toFixed(3)}g {t("kSorb")}
              </TableCell>
              <TableCell className="text-center">
                <div className="flex items-center gap-2 justify-center">
                  {sulfite.toFixed(3)}g{" "}
                  <Select
                    value={stabilizerType}
                    onValueChange={setStabilizerType}
                  >
                    <SelectTrigger className="w-max">
                      <SelectValue></SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="kMeta"> {t("kMeta")}</SelectItem>
                      <SelectItem value="naMeta">{t("naMeta")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>{" "}
                <p>{t("accountPage.or")}</p>{" "}
                <p className="flex items-center justify-center gap-2">
                  {Math.round(campden * 10) / 10} {t("campden")}
                  <Tooltip body={t("tipText.campden")} />
                </p>
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>
    </div>
  );
};

export default Stabilizers;

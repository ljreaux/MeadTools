"use client";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import useBrix from "@/hooks/useBrix";
import { useTranslation } from "react-i18next";

function Brix() {
  const { t } = useTranslation();
  const { gravity, sg, brix, units, setGravity, setUnits } = useBrix();

  const displayString =
    units === "SG"
      ? `${Math.round(brix * 100) / 100} ${t("BRIX")}`
      : Math.round(sg * 1000) / 1000;
  return (
    <>
      <h1 className="sm:text-3xl text-xl text-center">{t("brixHeading")} </h1>
      <label htmlFor="gravity">{t("gravityLabel")}</label>

      <Input
        type="number"
        id="gravity"
        onFocus={(e) => e.target.select()}
        value={gravity}
        onChange={(e) => setGravity(Number(e.target.value))}
      />

      <Select name="units" onValueChange={setUnits}>
        <SelectTrigger>
          <SelectValue placeholder={t("SG")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="SG">{t("SG")}</SelectItem>
          <SelectItem value="Brix">{t("BRIX")}</SelectItem>
        </SelectContent>
      </Select>

      <p className="text-center text-lg">{displayString}</p>
    </>
  );
}

export default Brix;

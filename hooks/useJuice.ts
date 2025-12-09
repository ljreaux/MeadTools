import { toSG } from "@/lib/utils/unitConverter";
import { useEffect, useState, useCallback, useMemo } from "react";
import { parseNumber } from "@/lib/utils/validateInput";

export default function useJuice() {
  const [sugar, setSugar] = useState("0");
  const [sugarUnits, setSugarUnits] = useState("g");
  const [servingSize, setServingSize] = useState("0");
  const [servingSizeUnits, setServingSizeUnits] = useState("ml");
  const [servings, setServings] = useState("0");

  // Safely convert a stored string by a multiplier, preserving invalid strings
  const convertValue = useCallback((value: string, multiplier: number) => {
    const num = parseNumber(value);
    if (!Number.isFinite(num)) return value;

    const next = Math.round(num * multiplier * 10000) / 10000;
    return next.toString();
  }, []);

  // Derived brix
  const brix = useMemo(() => {
    const sugarMultiplier = sugarUnits === "mg" ? 0.001 : 1;
    const servingMultiplier = servingSizeUnits === "floz" ? 29.5735 : 1;

    const sugarNum = parseNumber(sugar) * sugarMultiplier;
    const servingNum = parseNumber(servingSize) * servingMultiplier;

    if (
      !Number.isFinite(sugarNum) ||
      !Number.isFinite(servingNum) ||
      servingNum <= 0
    ) {
      return 0;
    }

    const calculated = Math.round((sugarNum / servingNum) * 100 * 1000) / 1000;

    if (!Number.isFinite(calculated) || calculated > 1000) return 0;
    return calculated;
  }, [sugar, sugarUnits, servingSize, servingSizeUnits]);

  // Derived SG
  const sg = useMemo(() => Math.round(toSG(brix) * 1000) / 1000, [brix]);

  // Total sugar (per container)
  const totalSugar = useMemo(() => {
    const sugarNum = parseNumber(sugar);
    const servingsNum = parseNumber(servings);

    if (!Number.isFinite(sugarNum) || !Number.isFinite(servingsNum)) {
      return 0;
    }

    const calculated = Math.round(sugarNum * servingsNum * 1000) / 1000;
    return Number.isFinite(calculated) ? calculated : 0;
  }, [sugar, servings]);

  // Unit conversions – keep the same behavior, but safe
  useEffect(() => {
    // switching g → mg or mg → g
    const multiplier = sugarUnits === "mg" ? 1000 : 0.001;
    setSugar((prev) => convertValue(prev, multiplier));
  }, [sugarUnits, convertValue]);

  useEffect(() => {
    // switching ml → floz or floz → ml
    const multiplier = servingSizeUnits === "floz" ? 0.033814 : 29.5735;
    setServingSize((prev) => convertValue(prev, multiplier));
  }, [servingSizeUnits, convertValue]);

  return {
    sugar,
    servingSize,
    servings,
    sugarUnits,
    servingSizeUnits,
    setSugar,
    setServingSize,
    setServings,
    setSugarUnits,
    setServingSizeUnits,
    brix,
    sg,
    totalSugar
  };
}

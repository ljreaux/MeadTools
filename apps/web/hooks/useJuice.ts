import { juiceLabelEstimate } from "@meadtools/core/extra-calculators";
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

  const {
    brix,
    specificGravity: sg,
    totalSugar
  } = useMemo(
    () =>
      juiceLabelEstimate(
        parseNumber(sugar),
        sugarUnits === "mg" ? "mg" : "g",
        parseNumber(servingSize),
        servingSizeUnits === "floz" ? "floz" : "ml",
        parseNumber(servings)
      ),
    [sugar, sugarUnits, servingSize, servingSizeUnits, servings]
  );

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

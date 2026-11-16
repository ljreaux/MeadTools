import {
  convertJuiceServing,
  convertJuiceSugar,
  juiceLabelEstimate
} from "@meadtools/core/extra-calculators";
import { useEffect, useState, useCallback, useMemo } from "react";
import { parseNumber } from "@/lib/utils/validateInput";

export default function useJuice() {
  const [sugar, setSugar] = useState("0");
  const [sugarUnits, setSugarUnits] = useState("g");
  const [servingSize, setServingSize] = useState("0");
  const [servingSizeUnits, setServingSizeUnits] = useState("ml");
  const [servings, setServings] = useState("0");

  // Safely convert a stored string, preserving invalid strings
  const convertValue = useCallback(
    (value: string, convert: (num: number) => number) => {
      const num = parseNumber(value);
      if (!Number.isFinite(num)) return value;
      return convert(num).toString();
    },
    []
  );

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
    const to = sugarUnits === "mg" ? "mg" : "g";
    const from = to === "mg" ? "g" : "mg";
    setSugar((prev) => convertValue(prev, (num) => convertJuiceSugar(num, from, to)));
  }, [sugarUnits, convertValue]);

  useEffect(() => {
    // switching ml → floz or floz → ml
    const to = servingSizeUnits === "floz" ? "floz" : "ml";
    const from = to === "floz" ? "ml" : "floz";
    setServingSize((prev) =>
      convertValue(prev, (num) => convertJuiceServing(num, from, to))
    );
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

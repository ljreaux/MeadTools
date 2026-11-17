import {
  convertJuiceServing,
  convertJuiceSugar,
  juiceLabelEstimate
} from "@meadtools/core/extra-calculators";
import { switchUnitText, type UnitSwitch } from "@meadtools/core/numeric";
import { useState, useCallback, useMemo, useRef } from "react";
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

  // Convert the typed values when a unit changes. This runs in the change
  // handlers, not effects, so nothing converts on load. Switching straight back
  // restores what was typed (240 ml → 8.1154 fl oz → 240 ml).
  const lastSugarSwitch = useRef<UnitSwitch<"g" | "mg"> | null>(null);
  const changeSugarUnits = (value: string) => {
    const to = value === "mg" ? "mg" : "g";
    const from = sugarUnits === "mg" ? "mg" : "g";
    if (to === from) return;
    const result = switchUnitText(
      sugar,
      from,
      to,
      (text) => convertValue(text, (num) => convertJuiceSugar(num, from, to)),
      lastSugarSwitch.current
    );
    lastSugarSwitch.current = result.last;
    setSugar(result.text);
    setSugarUnits(to);
  };

  const lastServingSwitch = useRef<UnitSwitch<"ml" | "floz"> | null>(null);
  const changeServingSizeUnits = (value: string) => {
    const to = value === "floz" ? "floz" : "ml";
    const from = servingSizeUnits === "floz" ? "floz" : "ml";
    if (to === from) return;
    const result = switchUnitText(
      servingSize,
      from,
      to,
      (text) => convertValue(text, (num) => convertJuiceServing(num, from, to)),
      lastServingSwitch.current
    );
    lastServingSwitch.current = result.last;
    setServingSize(result.text);
    setServingSizeUnits(to);
  };

  return {
    sugar,
    servingSize,
    servings,
    sugarUnits,
    servingSizeUnits,
    setSugar,
    setServingSize,
    setServings,
    setSugarUnits: changeSugarUnits,
    setServingSizeUnits: changeServingSizeUnits,
    brix,
    sg,
    totalSugar
  };
}

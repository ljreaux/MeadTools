import { useEffect, useMemo, useRef, useState } from "react";
import { parseNumber } from "@/lib/utils/validateInput";

type VolumeUnit = "gal" | "lit";
export type StabilizerType = "kMeta" | "naMeta";

function roundTo(n: number, decimals: number) {
  const p = 10 ** decimals;
  return Math.round(n * p) / p;
}

function toFixedString(n: number, decimals: number) {
  // keep it simple + predictable for inputs
  return String(roundTo(n, decimals));
}

const useStabilizers = () => {
  // inputs as STRINGS (so "12." can exist)
  const [volume, setVolume] = useState("1");
  const [volumeUnits, setVolumeUnits] = useState<VolumeUnit>("gal");
  const [abv, setAbv] = useState("12");
  const [phReading, setPhReading] = useState("3.6");

  const [stabilizerType, setStabilizerType] = useState<StabilizerType>("kMeta");

  const [takingReading, setTakingReading] = useState(false);

  // results as NUMBERS (derived)
  const [sorbate, setSorbate] = useState(0);
  const [sulfite, setSulfite] = useState(0);
  const [campden, setCampden] = useState(0);

  // parse helpers (parseNumber should happily parse "12." -> 12)
  const volumeNum = useMemo(() => parseNumber(volume || "0"), [volume]);
  const abvNum = useMemo(() => parseNumber(abv || "0"), [abv]);
  const phNum = useMemo(() => parseNumber(phReading || "0"), [phReading]);

  // if user isn't taking a reading, we keep pH at 3.6 (as a string)
  useEffect(() => {
    if (!takingReading) setPhReading("3.6");
  }, [takingReading]);

  // main calculations
  useEffect(() => {
    const ph = roundTo(phNum, 1);

    // NOTE: your original code converts to cubic meters (m^3)
    // gal -> m^3 via * 0.003785..., liters -> m^3 via / 1000
    const volM3 =
      volumeUnits === "gal" ? volumeNum * 0.003785411784 : volumeNum / 1000;

    const sorbateG = ((-abvNum * 25 + 400) / 0.75) * volM3;
    setSorbate(sorbateG);

    let ppm = 50;
    if (ph <= 2.9) ppm = 11;
    if (ph === 3) ppm = 13;
    if (ph === 3.1) ppm = 16;
    if (ph === 3.2) ppm = 21;
    if (ph === 3.3) ppm = 26;
    if (ph === 3.4) ppm = 32;
    if (ph === 3.5) ppm = 39;
    if (ph === 3.6) ppm = 50;
    if (ph === 3.7) ppm = 63;
    if (ph === 3.8) ppm = 98;
    if (ph >= 3.9) ppm = 123;

    const multiplier = stabilizerType === "kMeta" ? 570 : 674;

    const sulfiteG =
      volumeUnits === "gal"
        ? (volumeNum * 3.785 * ppm) / multiplier
        : (volumeNum * ppm) / multiplier;
    setSulfite(sulfiteG);

    const campdenTabs =
      volumeUnits !== "gal"
        ? (ppm / 75) * (volumeNum / 3.785)
        : (ppm / 75) * volumeNum;
    setCampden(campdenTabs);
  }, [abvNum, volumeNum, phNum, stabilizerType, volumeUnits]);

  // convert the *string* volume when units change (skip first run)
  const didInitUnits = useRef(false);
  useEffect(() => {
    if (!didInitUnits.current) {
      didInitUnits.current = true;
      return;
    }

    const v = parseNumber(volume || "0");
    const converted = volumeUnits === "lit" ? v * 3.785 : v / 3.785;

    setVolume(toFixedString(converted, 3));
  }, [volumeUnits]); // intentionally only units

  return {
    // inputs (strings)
    volume,
    setVolume,
    volumeUnits,
    setVolumeUnits,
    abv,
    setAbv,
    phReading,
    setPhReading,

    takingReading,
    setTakingReading,
    stabilizerType,
    setStabilizerType,

    // results (numbers)
    sorbate,
    sulfite,
    campden
  };
};

export default useStabilizers;

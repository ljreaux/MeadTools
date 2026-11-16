import {
  convertStabilizerVolume,
  stabilizerAdditions
} from "@meadtools/core/extra-calculators";
import { useEffect, useMemo, useRef, useState } from "react";
import { parseNumber } from "@/lib/utils/validateInput";

type VolumeUnit = "gal" | "lit";
export type StabilizerType = "kMeta" | "naMeta";

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
    const additions = stabilizerAdditions({
      volume: volumeNum,
      unit: volumeUnits,
      abv: abvNum,
      ph: phNum,
      type: stabilizerType
    });
    setSorbate(additions.sorbateGrams);
    setSulfite(additions.sulfiteGrams);
    setCampden(additions.campdenTablets);
  }, [abvNum, volumeNum, phNum, stabilizerType, volumeUnits]);

  // convert the *string* volume when units change (skip first run)
  const didInitUnits = useRef(false);
  useEffect(() => {
    if (!didInitUnits.current) {
      didInitUnits.current = true;
      return;
    }

    const v = parseNumber(volume || "0");
    const from = volumeUnits === "lit" ? "gal" : "lit";
    setVolume(String(convertStabilizerVolume(v, from, volumeUnits)));
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

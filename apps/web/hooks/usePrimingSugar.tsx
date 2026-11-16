"use client";

import {
  PRIMING_CO2_RANGE,
  PRIMING_TEMPERATURE_RANGE,
  primingSugarOptions,
  primingSugarTable
} from "@meadtools/core/extra-calculators";
import { useMemo, useState } from "react";
import { toCelsius, toFahrenheit } from "@meadtools/core/temperature";
import { isValidNumber, parseNumber } from "@/lib/utils/validateInput";
import { useIngredientsQuery } from "@/hooks/reactQuery/useIngredientsQuery";

const usePrimingSugar = () => {
  // 🔁 Fetch sugar ingredients via React Query
  const { data: ingredientData, isLoading } = useIngredientsQuery("sugar");

  // Derived sugar definitions from ingredients
  const sugars = useMemo(
    () => (ingredientData ? primingSugarOptions(ingredientData) : null),
    [ingredientData]
  );

  const [temp, setTemp] = useState("68");
  const [tempUnits, setTempUnits] = useState<"C" | "F">("F");
  const [tempInvalid, setTempInvalid] = useState(false);

  const [vols, setVols] = useState("2.4");
  const [volsInvalid, setVolsInvalid] = useState(false);

  const [volume, setVolume] = useState("0");
  const [volumeUnits, setVolumeUnits] = useState<"gal" | "lit">("gal");

  const handleTempChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isValidNumber(e.target.value)) return;
    const { min: validRangeStart, max: validRangeEnd } =
      PRIMING_TEMPERATURE_RANGE[tempUnits];
    const parsedTemp = parseNumber(e.target.value);

    if (parsedTemp < validRangeStart || parsedTemp > validRangeEnd) {
      setTempInvalid(true);
    } else {
      setTempInvalid(false);
    }

    setTemp(e.target.value);
  };

  const handleVolsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isValidNumber(e.target.value)) return;
    const parsedVols = parseNumber(e.target.value);
    if (parsedVols < PRIMING_CO2_RANGE.min || parsedVols > PRIMING_CO2_RANGE.max) {
      setVolsInvalid(true);
    } else {
      setVolsInvalid(false);
    }
    setVols(e.target.value);
  };

  return {
    ingredientsLoading: isLoading,
    tempProps: {
      value: temp,
      onChange: handleTempChange
    },
    tempInvalid,

    volsProps: {
      value: vols,
      onChange: handleVolsChange
    },
    volsInvalid,

    volumeProps: {
      value: volume,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
        if (isValidNumber(e.target.value)) setVolume(e.target.value);
      }
    },
    volumeUnitProps: {
      onValueChange: (val: string) => {
        setVolumeUnits(val as "gal" | "lit");
        if (volumeUnits === "lit") {
          setVolume((parseNumber(volume) / 3.78541).toString());
        } else {
          setVolume((parseNumber(volume) * 3.78541).toString());
        }
      },
      value: volumeUnits
    },
    tempUnitProps: {
      onValueChange: (val: string) => {
        setTempUnits(val as "C" | "F");
        if (tempUnits === "C") {
          setTemp(toFahrenheit(parseNumber(temp)).toString());
        } else {
          setTemp(toCelsius(parseNumber(temp)).toString());
        }
      },
      value: tempUnits
    },

    primingSugarAmounts: sugars
      ? primingSugarTable({
          temperature: parseNumber(temp),
          temperatureScale: tempUnits,
          co2Volumes: parseNumber(vols),
          volume: parseNumber(volume),
          volumeUnit: volumeUnits,
          sugars
        }).map((row) => ({
          label: row.label,
          amount: row.totalGrams,
          perBottle: row.perBottle.map(({ label, grams }) => ({ label, amount: grams }))
        }))
      : undefined
  };
};

export default usePrimingSugar;

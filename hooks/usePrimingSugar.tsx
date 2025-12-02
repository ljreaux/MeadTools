"use client";

import { useEffect, useMemo, useState } from "react";
import { toCelsius, toFahrenheit } from "@/lib/utils/temperature";
import { isValidNumber, parseNumber } from "@/lib/utils/validateInput";
import { useIngredientsQuery } from "@/hooks/reactQuery/useIngredientsQuery";

type Sugar =
  | {
      label: string;
      amount: number;
    }[]
  | null;

const ozToGal = 0.0078125;

const bottleSizes = [
  { size: 12, label: "12 oz" },
  { size: 22, label: "22 oz" },
  { size: 11.1586, label: "330 ml" },
  { size: 16.907, label: "500 ml" },
  { size: 25.3605, label: "750 ml" }
].map((item) => ({
  ...item,
  size: item.size * ozToGal
}));

const calcAmountPerBottle = (numberOfBottles: number, totalSugar: number) =>
  numberOfBottles > 0 ? totalSugar / numberOfBottles : 0;

const usePrimingSugar = () => {
  // 🔁 Fetch sugar ingredients via React Query
  const { data: ingredientData, isLoading } = useIngredientsQuery("sugar");

  // Derived sugar definitions from ingredients
  const sugars: Sugar = useMemo(() => {
    if (!ingredientData) return null;

    return ingredientData
      .map((sugar) => ({
        label: sugar.name,
        amount: 100 / parseFloat(sugar.sugar_content)
      }))
      .sort((a, b) => {
        const isPriority = (label: string) =>
          label === "Table Sugar" || label === "Corn Sugar";

        const aPri = isPriority(a.label);
        const bPri = isPriority(b.label);

        if (aPri && !bPri) return -1;
        if (!aPri && bPri) return 1;
        return a.label.localeCompare(b.label);
      });
  }, [ingredientData]);

  const [temp, setTemp] = useState("68");
  const [tempUnits, setTempUnits] = useState<"C" | "F">("F");
  const [tempInvalid, setTempInvalid] = useState(false);

  const [vols, setVols] = useState("2.4");
  const [volsInvalid, setVolsInvalid] = useState(false);

  const [volume, setVolume] = useState("0");
  const [volumeUnits, setVolumeUnits] = useState<"gal" | "lit">("gal");

  const [primingSugar, setPrimingSugar] = useState({
    sugar: 0,
    parsedVolume: 0
  });

  const calcPrimingSugar = (temp: string, vols: string, volume: string) => {
    const parsedVolume =
      volumeUnits === "gal"
        ? parseNumber(volume)
        : parseNumber(volume) / 3.78541;

    const parsedTemp =
      tempUnits === "F" ? parseNumber(temp) : toFahrenheit(parseNumber(temp));

    const sugar =
      15.195 *
      parsedVolume *
      (parseNumber(vols) -
        3.0378 +
        5.0062 * 10 ** -2 * parsedTemp -
        2.6555 * 10 ** -4 * parsedTemp ** 2);

    return {
      sugar,
      parsedVolume
    };
  };

  const handleTempChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isValidNumber(e.target.value)) return;
    const validRangeStart = tempUnits === "F" ? 32 : 0;
    const validRangeEnd = tempUnits === "F" ? 110 : 44;
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
    if (parsedVols < 0 || parsedVols > 6) {
      setVolsInvalid(true);
    } else {
      setVolsInvalid(false);
    }
    setVols(e.target.value);
  };

  useEffect(() => {
    setPrimingSugar(calcPrimingSugar(temp, vols, volume));
  }, [temp, vols, volume, volumeUnits, tempUnits]);

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

    primingSugarAmounts: sugars?.map((sugar) => {
      const totalSugar = sugar.amount * primingSugar.sugar;

      return {
        ...sugar,
        amount: totalSugar,
        perBottle: bottleSizes.map(({ label, size }) => {
          const numberOfBottles = primingSugar.parsedVolume / size;

          return {
            label,
            amount: calcAmountPerBottle(numberOfBottles, totalSugar)
          };
        })
      };
    })
  };
};

export default usePrimingSugar;

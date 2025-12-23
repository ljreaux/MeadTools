"use client";
import { useYeastsQuery } from "@/hooks/reactQuery/useYeastsQuery";
import { toBrix } from "@/lib/utils/unitConverter";
import { isValidNumber, parseNumber } from "@/lib/utils/validateInput";
import {
  FullNutrientData,
  GoFermType,
  initialFullData,
  maxGpl,
  NitrogenRequirement,
  NutrientType,
  ScheduleType,
  VolumeUnits,
  YeastBrand
} from "@/types/nutrientTypes";
import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect
} from "react";
import { useTranslation } from "react-i18next";

const NutrientContext = createContext<NutrientType | undefined>(undefined);

export const NutrientProvider = ({
  children,
  recipeData,
  storeData
}: {
  children: ReactNode;
  recipeData?: {
    volume: string;
    units: string;
    sg: string;
    offset: string;
    numberOfAdditions: string;
  };
  storeData?: boolean;
}) => {
  const { i18n } = useTranslation();
  const currentLocale = i18n.resolvedLanguage;

  const { data, isPending: loadingYeasts } = useYeastsQuery();
  const yeastList = data ?? [];

  const [fullData, setFullData] = useState<FullNutrientData>(initialFullData);

  const [selectedGpl, setSelectedGpl] = useState(
    maxGpl.tosna.value as string[]
  );
  const [nuteArr, setNuteArr] = useState<string[]>([]);
  const [yeastAmount, setYeastAmount] = useState("0");
  const [goFerm, setGoFerm] = useState({
    type: "Go-Ferm" as GoFermType,
    amount: 0,
    water: 0
  });
  const [targetYAN, setTargetYAN] = useState(0);
  const [nutrientAdditions, setNutrientAdditions] = useState<{
    totalGrams: number[];
    perAddition: number[];
  }>({
    totalGrams: [],
    perAddition: []
  });

  const [yanContributions, setYanContributions] = useState([
    "40",
    "100",
    "210",
    "0"
  ]);
  const [otherNutrientName, setOtherNutrientName] = useState("");
  const [remainingYan, setRemainingYan] = useState(0);
  const [providedYan, setProvidedYan] = useState(["0", "0", "0", "0"]);
  const [adjustAllowed, setAdjustAllowed] = useState(false);

  const calculateGoFerm = (type: GoFermType, yeastAmount: number) => {
    let multiplier = 0;
    let waterMultiplier = 20;
    if (type == "none") {
      waterMultiplier *= 0;
    }
    if (type == "Go-Ferm" || type == "protect") {
      multiplier = 1.25;
    }
    if (type == "sterol-flash") {
      multiplier = 1.2;
      waterMultiplier /= 2;
    }
    const goFerm = yeastAmount * multiplier;
    const goFermWater = goFerm * waterMultiplier;
    return {
      amount: Math.round(goFerm * 100) / 100,
      water: Math.round(goFermWater * 100) / 100
    };
  };
  const changeGfType = (type: GoFermType) => {
    setGoFerm((prev) => ({ ...prev, type }));
    setFullData((prev) => ({
      ...prev,
      outputs: {
        ...prev.outputs,
        goFerm: {
          water: prev.outputs.goFerm?.water || 0,
          amount: prev.outputs.goFerm?.amount || 0,
          type
        }
      }
    }));
  };

  // Setters for handling input change
  const setVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (isValidNumber(value)) {
      setFullData((prev) => ({
        ...prev,
        inputs: { ...prev.inputs, volume: value }
      }));
    }
  };

  const setSG = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (isValidNumber(value)) {
      setFullData((prev) => ({
        ...prev,
        inputs: { ...prev.inputs, sg: value }
      }));
    }
  };

  const setOffset = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (isValidNumber(value)) {
      setFullData((prev) => ({
        ...prev,
        inputs: { ...prev.inputs, offset: value }
      }));
    }
  };
  const setOtherYanContribution = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (isValidNumber(value)) {
      setYanContributions((prev) => {
        const newArr = [...prev];
        newArr[3] = value;
        return newArr;
      });
    }
  };

  const changeYeastAmount = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (isValidNumber(value)) {
      setYeastAmount(value);
      const amount = parseNumber(value);

      setFullData((prev) => ({
        ...prev,
        outputs: {
          ...prev.outputs,
          yeastAmount: amount
        }
      }));
    }
  };

  const setNumberOfAdditions = (value: string) => {
    if (!isNaN(parseInt(value, 10))) {
      localStorage.setItem("numberOfAdditions", value);
      setFullData((prev) => ({
        ...prev,
        inputs: { ...prev.inputs, numberOfAdditions: value }
      }));
    }
  };

  const setYeastBrand = (brand: YeastBrand) => {
    // Find the first yeast of the selected brand
    const firstYeast = yeastList.find((yeast) => yeast.brand === brand);

    // Set yeastStrain to the first yeast's name if found, or leave as is
    setFullData((prev) => ({
      ...prev,
      selected: {
        ...prev.selected,
        yeastBrand: brand,
        yeastStrain: firstYeast ? firstYeast.name : prev.selected.yeastStrain,
        yeastDetails: firstYeast || prev.selected.yeastDetails
      }
    }));
  };

  const setYeastName = (name: string) => {
    const yeast = yeastList.find((yeast) => yeast.name === name);
    if (yeast) {
      setFullData((prev) => ({
        ...prev,
        selected: {
          ...prev.selected,
          yeastStrain: name,
          yeastDetails: yeast
        }
      }));
    } else {
      setFullData((prev) => ({
        ...prev,
        selected: {
          ...prev.selected,
          yeastStrain: name,
          yeastDetails: {
            ...prev.selected.yeastDetails,
            id: 103,
            brand: "Other",
            name
          }
        }
      }));
    }
  };

  const setNitrogenRequirement = (req: NitrogenRequirement) => {
    setFullData((prev) => ({
      ...prev,
      selected: {
        ...prev.selected,
        yeastDetails: {
          ...prev.selected.yeastDetails,
          nitrogen_requirement: req
        }
      }
    }));
  };

  const setVolumeUnits = (unit: VolumeUnits) => {
    setFullData((prev) => ({
      ...prev,
      selected: {
        ...prev.selected,
        volumeUnits: unit // Update the volumeUnits field when changed
      }
    }));
  };

  const changeNutrientName = (e: React.ChangeEvent<HTMLInputElement>) => {
    setOtherNutrientName(e.target.value);
  };

  const setSelectedNutrients = (nutrients: string[]) => {
    setNuteArr(nutrients);
    let schedule: ScheduleType = "other"; // Default to "other" if no predefined selection matches

    if (nutrients.includes("Other")) {
      schedule = "other";
    } else if (
      nutrients.includes("Fermaid O") &&
      nutrients.includes("Fermaid K") &&
      nutrients.includes("DAP")
    ) {
      schedule = "tbe"; // Fermaid O, Fermaid K, and DAP
    } else if (
      nutrients.includes("Fermaid O") &&
      nutrients.includes("Fermaid K")
    ) {
      schedule = "oAndk"; // Fermaid O & K
    } else if (nutrients.includes("Fermaid O") && nutrients.includes("DAP")) {
      schedule = "oAndDap"; // Fermaid O & DAP
    } else if (nutrients.includes("Fermaid K") && nutrients.includes("DAP")) {
      schedule = "kAndDap"; // Fermaid K & DAP
    } else if (nutrients.includes("Fermaid O")) {
      schedule = "tosna"; // Fermaid O Only
    } else if (nutrients.includes("Fermaid K")) {
      schedule = "justK"; // Fermaid K Only
    } else if (nutrients.includes("DAP")) {
      schedule = "dap"; // DAP Only
    }

    setFullData((prev) => ({
      ...prev,
      selected: {
        ...prev.selected,
        selectedNutrients: nutrients,
        schedule: schedule // Set the schedule based on selected nutrients
      }
    }));
  };

  const editMaxGpl = (index: number, value: string) => {
    const copyArr = [...selectedGpl];
    copyArr[index] = value;
    setSelectedGpl(copyArr);
  };

  const editYanContribution = (index: number, value: string) => {
    const copyArr = [...yanContributions];
    copyArr[index] = value;
    setYanContributions(copyArr);
  };

  // set Nitrogen requirement in global state
  useEffect(() => {
    setFullData((prev) => {
      return {
        ...prev,
        selected: {
          ...prev.selected,
          n2Requirement: fullData.selected.yeastDetails.nitrogen_requirement
        }
      };
    });
  }, [fullData.selected.yeastDetails]);

  // determine yeast and go-ferm amounts
  useEffect(() => {
    const units = fullData.selected.volumeUnits;
    const volume = parseNumber(fullData.inputs.volume);
    const sg = parseNumber(fullData.inputs.sg);

    let multiplier = 1;
    if (units === "liter") {
      multiplier /= 3.78541;
    }

    if (sg >= 1.125) {
      multiplier *= 4;
    } else if (sg > 1.1 && sg < 1.125) {
      multiplier *= 3;
    } else {
      multiplier *= 2;
    }

    const yeastAmount = Math.round(volume * multiplier * 100) / 100;
    const gf = calculateGoFerm(goFerm.type, yeastAmount);

    setGoFerm((prev) => ({ ...prev, ...gf }));
    setYeastAmount(
      yeastAmount.toLocaleString(currentLocale, {
        maximumFractionDigits: 2
      })
    );
    setFullData((prev) => ({
      ...prev,
      outputs: {
        ...prev.outputs,
        yeastAmount: yeastAmount,
        goFerm: {
          type: prev.outputs.goFerm?.type || "Go-Ferm",
          ...gf
        }
      }
    }));
  }, [
    fullData.inputs.volume,
    fullData.inputs.sg,
    fullData.selected.volumeUnits
  ]);
  useEffect(() => {
    const gf = calculateGoFerm(goFerm.type, parseNumber(yeastAmount));

    setGoFerm((prev) => ({ ...prev, ...gf }));
    setFullData((prev) => ({
      ...prev,
      outputs: {
        ...prev.outputs,
        goFerm: {
          type: prev.outputs.goFerm?.type || "Go-Ferm",
          ...gf
        }
      }
    }));
  }, [yeastAmount, goFerm.type]);

  // Calculate target YAN
  const calculateYAN = () => {
    const sg = parseNumber(fullData.inputs.sg);
    const offset = parseNumber(fullData.inputs.offset || "0");
    const nitrogen = fullData.selected.n2Requirement;

    const multiplier =
      nitrogen == "Low"
        ? 0.75
        : nitrogen == "Medium"
        ? 0.9
        : nitrogen == "High"
        ? 1.25
        : 1.8;
    const gpl = toBrix(sg) * sg * 10;
    const targetYan = gpl * multiplier;
    return Math.round(targetYan - offset);
  };
  // calculate the target YAN
  useEffect(() => {
    if (!adjustAllowed) {
      // Calculate nutrient additions based on target YAN
      const calculateNutrientAdditions = (
        totalYan: number,
        currentYanContribution = [40, 100, 210, 0]
      ) => {
        const units = fullData.selected.volumeUnits;
        const volume = parseNumber(fullData.inputs.volume);
        const numberOfAdditions = parseNumber(
          fullData.inputs.numberOfAdditions
        );

        let remainingYan = totalYan;
        const yanContribution = [...currentYanContribution];
        let organicNutrientMultiplier = 4;
        if (goFerm.type == "none") organicNutrientMultiplier = 3;

        yanContribution[0] *= organicNutrientMultiplier;

        const ppmYan = [0, 0, 0, 0];

        for (let i = 0; i < yanContribution.length; i++) {
          const totalYan = yanContribution[i] * parseNumber(selectedGpl[i]);
          if (totalYan >= remainingYan) {
            ppmYan[i] = remainingYan;
            remainingYan = 0;
            break;
          }
          ppmYan[i] = totalYan;
          remainingYan -= totalYan;
        }

        const totalGrams = ppmYan.map((num, i) => {
          const contribution =
            yanContribution[i] === 0 ? 0 : num / yanContribution[i];

          return units === "liter"
            ? contribution * volume
            : contribution * volume * 3.785;
        });

        const perAddition = totalGrams.map((num) => num / numberOfAdditions);

        setRemainingYan(remainingYan);
        setProvidedYan(ppmYan.map((num) => num.toLocaleString(currentLocale)));
        return { totalGrams, perAddition };
      };

      // Calculate YAN and nutrient additions after fullData or schedule changes
      const yan = calculateYAN();
      const additions = calculateNutrientAdditions(
        yan,
        yanContributions.map(parseNumber)
      );

      setNutrientAdditions(additions);
      setTargetYAN(yan);
    }
  }, [
    fullData.inputs.sg,
    fullData.inputs.offset,
    fullData.selected.schedule,
    fullData.selected.yeastDetails.nitrogen_requirement,
    fullData.selected.n2Requirement,
    fullData.selected.volumeUnits,
    goFerm.type,
    selectedGpl,
    fullData.inputs.numberOfAdditions,
    yanContributions,
    nuteArr,
    adjustAllowed
  ]);

  useEffect(() => {
    if (adjustAllowed) {
      let totalYan = targetYAN;
      const yanContribution = yanContributions.map(parseNumber);
      const units = fullData.selected.volumeUnits;
      const volume = parseNumber(fullData.inputs.volume);
      const numberOfAdditions = parseNumber(fullData.inputs.numberOfAdditions);
      const ppmYan = providedYan.map(parseNumber);

      ppmYan.forEach((num) => (totalYan -= num));

      const totalGrams = ppmYan.map((num, i) => {
        const contribution =
          yanContribution[i] === 0 ? 0 : num / yanContribution[i];

        return units === "liter"
          ? contribution * volume
          : contribution * volume * 3.785;
      });

      const perAddition = totalGrams.map((num) => num / numberOfAdditions);

      setRemainingYan(totalYan);
      setNutrientAdditions({ totalGrams, perAddition });
    }
  }, [providedYan]);

  // determine how much yan comes from each source
  useEffect(() => {
    const { schedule } = fullData.selected;
    const value = maxGpl[schedule].value;
    const { sg } = fullData.inputs;
    const og = parseNumber(sg);

    if (schedule !== "other") {
      if (typeof value[0] === "string") {
        setSelectedGpl(value as string[]);
      } else {
        if (og <= 1.08) {
          setSelectedGpl(value[0]);
        } else if (og <= 1.11) {
          setSelectedGpl(value[1] as string[]);
        } else {
          setSelectedGpl(value[2] as string[]);
        }
      }
    } else {
      const nutrientValues = {
        "Fermaid O": "0.45",
        "Fermaid K": "0.5",
        DAP: "0.96",
        Other: "1"
      };

      // Ensure arr has a fixed order corresponding to "Fermaid O", "Fermaid K", "DAP", "Other"
      const arr = ["Fermaid O", "Fermaid K", "DAP", "Other"].map((nute) =>
        nuteArr.includes(nute)
          ? nutrientValues[nute as keyof typeof nutrientValues]
          : "0"
      );

      setSelectedGpl(arr);
    }
  }, [
    fullData.selected.schedule,
    fullData.inputs.sg,
    yanContributions,
    nuteArr
  ]);

  useEffect(() => {
    if (recipeData)
      setFullData((prev) => ({
        ...prev,
        inputs: { ...prev.inputs, ...recipeData },
        selected: {
          ...prev.selected,
          volumeUnits: recipeData.units as VolumeUnits
        }
      }));
  }, [recipeData]);

  useEffect(() => {
    if (storeData)
      localStorage.setItem("nutrientData", JSON.stringify(fullData));
  }, [fullData]);

  useEffect(() => {
    if (storeData) {
      localStorage.setItem(
        "yanContribution",
        JSON.stringify(yanContributions.map(parseNumber))
      );
      localStorage.setItem("selectedGpl", JSON.stringify(selectedGpl));
    }
  }, [yanContributions, selectedGpl]);

  useEffect(() => {
    if (storeData) localStorage.setItem("otherNutrientName", otherNutrientName);
  }, [otherNutrientName]);

  // Expose only the necessary state to the UI
  const uiState = {
    inputs: {
      volume: { value: fullData.inputs.volume, onChange: setVolume },
      sg: { value: fullData.inputs.sg, onChange: setSG },
      offset: { value: fullData.inputs.offset, onChange: setOffset },
      numberOfAdditions: {
        value: fullData.inputs.numberOfAdditions,
        onValueChange: setNumberOfAdditions
      },
      volumeUnits: {
        value: fullData.selected.volumeUnits,
        onChange: setVolumeUnits
      }
    },
    selected: {
      ...fullData.selected,
      yeastNitrogenRequirement: fullData.selected.n2Requirement
    },
    setVolume,
    setSG,
    setOffset,
    setNumberOfAdditions,
    setYeastBrand,
    setYeastName,
    setSelectedNutrients,
    yeastList,
    loadingYeasts,
    maxGpl: selectedGpl,
    targetYAN,
    yeastAmount,
    changeYeastAmount,
    goFermType: {
      value: goFerm.type,
      onChange: changeGfType
    },
    goFerm: {
      amount: goFerm.amount,
      water: goFerm.water
    },
    nutrientAdditions,
    setNitrogenRequirement,
    otherYanContribution: {
      value: yanContributions[3],
      onChange: setOtherYanContribution
    },
    otherNutrientName: {
      value: otherNutrientName,
      onChange: changeNutrientName
    },
    editMaxGpl,
    editYanContribution,
    yanContributions,
    remainingYan,
    providedYan,
    updateProvidedYan: (index: number, value: string) => {
      const arrCopy = [...providedYan];
      arrCopy[index] = value;
      setProvidedYan(arrCopy);
    },
    adjustAllowed,
    setAdjustAllowed,
    fullData
  };

  return (
    <NutrientContext.Provider value={uiState}>
      {children}
    </NutrientContext.Provider>
  );
};

export const useNutrients = () => {
  const context = useContext(NutrientContext);
  if (!context) {
    throw new Error("useNutrients must be used within a NutrientProvider");
  }
  return context;
};

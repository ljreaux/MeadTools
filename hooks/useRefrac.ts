import { toBrix, toSG } from "@/lib/utils/unitConverter";
import { isValidNumber, parseNumber } from "@/lib/utils/validateInput";
import { useState } from "react";

const useRefrac = () => {
  const [correctionFactor, setCorrectionFactor] = useState("1");
  const [og, setOg] = useState("1.1");
  const [ogUnits, setOgUnits] = useState<"SG" | "Brix">("SG");
  const [fg, setFg] = useState("8.5");
  const [fgUnits, setFgUnits] = useState<"SG" | "Brix">("Brix");

  const ogBrix = ogUnits === "Brix" ? parseNumber(og) : toBrix(parseNumber(og));
  const fgBrix = fgUnits === "Brix" ? parseNumber(fg) : toBrix(parseNumber(fg));

  const correctedFg = refracCalc(ogBrix, fgBrix, parseNumber(correctionFactor));

  const changeOgUnits = () => {
    if (ogUnits === "SG") {
      setOg(toBrix(parseNumber(og)).toFixed(2));
    } else {
      setOg(toSG(parseNumber(og)).toFixed(3));
    }
  };

  const changeFgUnits = () => {
    if (fgUnits === "SG") {
      setFg(toBrix(parseNumber(fg)).toFixed(2));
    } else {
      setFg(toSG(parseNumber(fg)).toFixed(3));
    }
  };

  return {
    correctionFactorProps: {
      value: correctionFactor,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
        if (isValidNumber(e.target.value)) {
          setCorrectionFactor(e.target.value);
        }
      },
    },
    ogProps: {
      value: og,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
        if (isValidNumber(e.target.value)) {
          setOg(e.target.value);
        }
      },
    },
    ogUnitProps: {
      value: ogUnits,
      onValueChange: (val: string) => {
        setOgUnits(val as "SG" | "Brix");
        changeOgUnits();
      },
    },
    fgProps: {
      value: fg,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
        if (isValidNumber(e.target.value)) {
          setFg(e.target.value);
        }
      },
    },
    fgUnitProps: {
      value: fgUnits,
      onValueChange: (val: string) => {
        setFgUnits(val as "SG" | "Brix");
        changeFgUnits();
      },
    },
    correctedFg,
    correctedBrix: toBrix(correctedFg),
  };
};

export default useRefrac;

function refracCalc(ogBr: number, fgBr: number, corFac: number) {
  return -0.002349 * (ogBr / corFac) + 0.006276 * (fgBr / corFac) + 1;
}

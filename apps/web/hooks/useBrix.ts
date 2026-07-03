import { toBrix, toSG } from "@meadtools/core/gravity";
import { parseNumber } from "@/lib/utils/validateInput";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

const useBrix = (initialVal?: string) => {
  const { i18n } = useTranslation();
  const currentLocale = i18n.resolvedLanguage;
  const [mount, setMount] = useState(true);
  const [brix, setBrix] = useState({
    gravity: initialVal || (1.1).toLocaleString(currentLocale),
    units: "SG",
    brix: toBrix(parseNumber(initialVal || "1.1")).toLocaleString(
      currentLocale
    ),
    sg: parseNumber(initialVal || "1.1").toLocaleString(currentLocale),
  });

  useEffect(() => {
    if (!mount) {
      if (brix.units === "Brix") {
        setBrix({
          ...brix,
          gravity: parseNumber(brix.brix).toLocaleString(currentLocale, {
            maximumFractionDigits: 2,
          }),
        });
      } else {
        setBrix({
          ...brix,
          gravity: parseNumber(brix.sg).toLocaleString(currentLocale, {
            maximumFractionDigits: 3,
          }),
        });
      }
    }
    setMount(false);
  }, [brix.units]);

  useEffect(() => {
    if (brix.units == "SG") {
      setBrix({
        ...brix,
        sg: brix.gravity,
        brix: toBrix(parseNumber(brix.gravity)).toLocaleString(currentLocale),
      });
    } else {
      setBrix({
        ...brix,
        brix: brix.gravity,
        sg: toSG(parseNumber(brix.gravity)).toLocaleString(currentLocale),
      });
    }
  }, [brix.gravity]);

  return {
    ...brix,
    setGravity: (val: string) => setBrix({ ...brix, gravity: val }),
    setUnits: (val: string) => setBrix({ ...brix, units: val }),
  };
};

export default useBrix;

import { useState, useEffect } from "react";

import { standaloneAlcohol } from "@meadtools/core/extra-calculators";
import { parseNumber } from "@/lib/utils/validateInput";

export default function useAbv(OG: string, FG: string) {
  const [abv, setAbv] = useState<{ ABV: number; delle: number }>({
    ABV: 0,
    delle: 0
  });

  useEffect(() => {
    const og = parseNumber(OG);
    const fg = parseNumber(FG);

    // If either parses badly, just reset to zeros
    if (!Number.isFinite(og) || !Number.isFinite(fg)) {
      setAbv({ ABV: 0, delle: 0 });
      return;
    }

    const result = standaloneAlcohol(og, fg);
    setAbv({ ABV: result.abvPercent, delle: result.delle });
  }, [OG, FG]);

  return abv;
}

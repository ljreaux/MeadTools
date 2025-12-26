import { useState, useEffect } from "react";

import { calcABV, toBrix } from "@/lib/utils/unitConverter";
import { parseNumber } from "@/lib/utils/validateInput";

function normalizeNumber(n: number): number {
  // Kill negative zero and tiny float noise
  if (Object.is(n, -0) || Math.abs(n) < 1e-10) return 0;
  if (!Number.isFinite(n)) return 0;
  return n;
}

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

    const rawABV = calcABV(og, fg);
    const rawDelle = toBrix(fg) + 4.5 * rawABV;

    setAbv({
      ABV: normalizeNumber(rawABV),
      delle: normalizeNumber(rawDelle)
    });
  }, [OG, FG]);

  return abv;
}

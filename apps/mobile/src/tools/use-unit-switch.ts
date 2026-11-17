import { useCallback, useRef } from "react";

import { switchUnitText, type UnitSwitch } from "@meadtools/core/numeric";

/**
 * Converts one field's typed value when its unit changes, remembering the last
 * switch so switching straight back restores exactly what was typed instead of
 * converting the rounded value back. Pass the current text, not a state
 * updater: React may run updaters twice, which would record the switch twice.
 */
export function useUnitSwitch<U extends string>() {
  const last = useRef<UnitSwitch<U> | null>(null);
  return useCallback((text: string, from: U, to: U, convert: (text: string) => string) => {
    const result = switchUnitText(text, from, to, convert, last.current);
    last.current = result.last;
    return result.text;
  }, []);
}

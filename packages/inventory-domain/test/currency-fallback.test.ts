import assert from "node:assert/strict";
import test from "node:test";

import { currencyCodeSchema, inventoryCurrencyCodes } from "../src/costing";

test("currency validation and choices work on engines without Intl.supportedValuesOf", () => {
  const supportedValuesOf = Object.getOwnPropertyDescriptor(Intl, "supportedValuesOf");
  Object.defineProperty(Intl, "supportedValuesOf", { configurable: true, value: undefined });
  try {
    assert(inventoryCurrencyCodes().includes("USD"));
    assert(inventoryCurrencyCodes().includes("EUR"));
    assert(inventoryCurrencyCodes().includes("JPY"));
    assert(currencyCodeSchema.safeParse("JPY").success);
    assert(!currencyCodeSchema.safeParse("ZZZ").success);
  } finally {
    if (supportedValuesOf) Object.defineProperty(Intl, "supportedValuesOf", supportedValuesOf);
    else Reflect.deleteProperty(Intl, "supportedValuesOf");
  }
});

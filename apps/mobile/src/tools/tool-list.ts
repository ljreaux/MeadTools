/** Calculators on the Tools tab, grouped like the web's calculator menus. */
export const toolGroups = [
  {
    key: "gravity",
    tools: [
      { href: "/tools/abv", label: "calculators.extraCalcs.abv" },
      { href: "/tools/brix", label: "calculators.extraCalcs.brix" },
      { href: "/tools/refractometer", label: "calculators.extraCalcs.refractometer" },
      { href: "/tools/temperature", label: "calculators.extraCalcs.tempCorrection" },
      { href: "/tools/estimated-og", label: "calculators.extraCalcs.estOG" }
    ]
  }
] as const;

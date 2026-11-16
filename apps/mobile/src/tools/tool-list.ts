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
  },
  {
    key: "stabilizers",
    tools: [
      { href: "/tools/stabilizers", label: "mobileTools.tools.stabilizers" },
      { href: "/tools/sulfite", label: "mobileTools.tools.sulfite" },
      { href: "/tools/sorbate", label: "mobileTools.tools.sorbate" }
    ]
  },
  {
    key: "finishing",
    tools: [
      { href: "/tools/blending", label: "calculators.extraCalcs.blending" },
      { href: "/tools/bench-trials", label: "calculators.extraCalcs.benchTrials" },
      { href: "/tools/priming-sugar", label: "primingSugarHeading" },
      { href: "/tools/bottling", label: "calculators.extraCalcs.bottling" }
    ]
  }
] as const;

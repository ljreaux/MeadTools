# Standalone calculators through MCP

Issue #465 inventory, audited against `extraCalculatorLinks`, calculator routes,
web hooks, shared core functions, hosted tools, and the MCP allowlist.

All calculator tools are stateless and available under the existing `mcp:tools`
scope. The authenticated premium entitlement, kill switch, usage accounting, and
rate limits still apply. No account-read grant, saved recipe, or brew is needed.
They are also registered with the hosted brewing assistant through the same
validated execution path. Existing tools retain their names and behavior.

## Inventory and overlap audit

| Web calculator                   | Tool                                                                                            | Shared implementation / distinction                                                                                                                                     |
| -------------------------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/extra-calcs` ABV               | `calculate_abv`                                                                                 | `core/gravity`: ABV and Delle from fermentation OG/FG                                                                                                                   |
| `/extra-calcs/abv`               | same as above                                                                                   | Redirect only; no duplicate tool                                                                                                                                        |
| Brix                             | `convert_brix_gravity`                                                                          | `core/gravity`: SG/Brix polynomials                                                                                                                                     |
| Estimated OG                     | `estimate_original_gravity`                                                                     | `core/extra-calculators`: finished hydrometer SG + refractometer Brix; rounds OG before ABV                                                                             |
| Sulfite                          | `calculate_sulfite`                                                                             | Shared ppm addition, grams and alternative Campden tablets                                                                                                              |
| Sorbate                          | `calculate_sorbate`                                                                             | Shared ABV-dependent potassium sorbate estimate                                                                                                                         |
| Refractometer correction         | `correct_refractometer`                                                                         | `core/gravity`: correction factor, corrected SG/Brix and ABV/Delle                                                                                                      |
| Temperature correction           | `correct_hydrometer_temperature`                                                                | `core/temperature`: measured/calibration temperature correction                                                                                                         |
| Blending                         | `calculate_blend`                                                                               | `core/blend`: volume-weighted like values                                                                                                                               |
| Priming sugar                    | `calculate_priming_sugar`                                                                       | Shared polynomial and standard bottle doses, ingredient sugar-content percentage                                                                                        |
| Bottling                         | `calculate_bottling`                                                                            | Shared nominal bottle sizes, custom unit conversion, totals and rounded-up row fill counts                                                                              |
| Bench trials                     | `calculate_bench_trial`                                                                         | Shared stock dosing and scaling with original intermediate rounding                                                                                                     |
| `/juice` label calculator        | `calculate_juice_sugar`                                                                         | Shared label sugar/serving concentration and container sugar; included despite separate route                                                                           |
| `/stabilizers` main page         | `calculate_sulfite` + `calculate_sorbate`                                                       | Same two component tools; optional `ph` selects the main page's shared pH lookup instead of explicit `ppm`                                                              |
| Gravity target planning          | existing `calculate_gravity_target`                                                             | Preserved: target ABV + planned fermentation FG → target OG, optionally offset. Different from estimating a missing historical OG.                                      |
| Recipe and nutrient calculations | existing `build_recipe_draft`, `explain_recipe` (hosted), `get_recipe` (authorized saved reads) | Preserve recipe calculation engine/workflows. Use these when working on a recipe rather than issuing standalone calculations. No duplicate recipe/nutrient engine tool. |

There are **12 new standalone tools**, in addition to the existing seven basic
MCP tools and seven optional private account reads. Discovery returns 19 tools
for basic scope and 26 with account-read permission. No active extra calculator
is excluded. The ABV alias route and combined stabilizer page reuse existing
entries above. Recipe building and nutrient planning remain in their existing
workflows.

## Inputs, output, and units

Discovery schemas describe required inputs, defaults, numeric bounds and result
keys. Inputs are strict: unknown properties, identities, NaN/Infinity, negative
volumes, unsupported units and invalid combinations are rejected. Successful
responses have `status: "ok"` and `result: { values, units, assumptions, warnings }`.
Each numeric result key has its unit in `units`; unrounded values are returned
unless the web formula itself rounds. Web display formatting remains a UI
concern. Errors return `status: "invalid_input"` and readable `issues`, with MCP
`isError: true`. Successful MCP calls include both structured content conforming
to the advertised output schema and equivalent JSON text.

- General volume units: `gal` (US gallons, default) or `lit` (liters).
  Different historical calculator conversion constants are deliberately preserved:
  sulfite/bench trials use 3.785; priming/bottling use 3.78541; sorbate uses
  3.785411784 L/US gal.
- Gravity is SG; Brix inputs are degrees Brix. Refractometer final readings must
  be Brix. Original readings can be SG/Brix. Default correction factor is 1;
  non-default factors produce a warning.
- Temperature uses `F` (default) or `C`; omitted calibration/priming temperature
  defaults to 68 F or 20 C. Priming limits match the web's 32–110 F / 0–44 C;
  hydrometer correction supports liquid-water temperatures 0–100 C.
- Sulfite defaults to potassium metabisulfite (`kMeta`) and 50 ppm. `naMeta`
  selects sodium metabisulfite. Supply either `ppm` or `ph`, never both. The pH
  lookup rounds to one decimal just like the main stabilizer page. Campden is an
  alternative sulfite form, not an additional dose.
- Sorbate accepts 0–16% ABV. Above 16%, the original polynomial would produce
  negative additions, so tool invocation rejects it rather than returning a dose.
- Priming defaults to 2.4 CO2 volumes and 100% sugar content (table sugar).
  For another sugar, obtain `sugar_content` from `search_ingredients` and supply
  `sugarContentPercent`; do not create a competing ingredient catalog. Returns
  total grams and per-bottle grams for the web's five standard bottle sizes.
  Targets below estimated residual CO2 are rejected. Zero batch volume returns
  zero total and per-bottle doses. Bottle suitability and finished fermentation
  still need to be established by the brewer.
- Bottling rows use a built-in label from `BOTTLE_SIZES_L` or `size: "custom"`
  with `customSize` and `customUnit` (`ml`, `liter`, `gallon`, `fl_oz`). Quantities
  must be whole nonnegative bottle counts. Results include negative remaining
  liters for over-allocation. `rowNBottlesToFill` is the replacement quantity
  for that row, accounting for all other allocations and rounding up, matching
  the web fill action.
- Bench trial inputs: stock mL, concentration percent w/v (g/100 mL), sample mL,
  batch size and `batchUnit` (`gallon` or `liter`). Includes stock volume in total
  sample volume. Results are adjunct grams, concentration mg/L, grams per batch
  unit and total batch grams; intermediate rounding matches the web.
- Juice inputs: sugar per serving (`g` or `mg`), positive serving size (`ml` or
  `floz`), and number of servings (default 1). SG and Brix use the web's rounding;
  total sugar remains in the input mass unit. This is a label estimate.
- Blend values and volumes must have matching units across rows. Declare both
  unit names; all-zero volume is rejected. This is linear averaging, including
  its limitations when blending quantities that are not linearly additive.

## Deterministic verification

`packages/recipe-agent/test/calculator-tools.test.ts` checks registration,
unique names, hosted/MCP parity without account access, typed schemas, original
formula expectations, conversions, rounding, boundaries and useful errors.
Core tests pin extracted calculation behavior. The existing offline MCP
permissions fixture invokes every calculator through the real SDK for both
scope grants, validates structured responses, and retains private-read denial
checks. No model calls or paid evaluation are involved.

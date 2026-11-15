# Standalone calculators through MCP

Issue #465 inventory, audited against `extraCalculatorLinks`, calculator routes,
web hooks, shared core functions, hosted tools, and the MCP allowlist.

All calculator tools are stateless and available under the existing `mcp:tools`
scope. The authenticated premium entitlement, kill switch, usage accounting, and
rate limits still apply. No account-read grant, saved recipe, or brew is needed.
The scalar calculators are also registered with the hosted brewing assistant.
The two fixed-recipe tools are available through MCP.

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
| Fixed ingredient volume | `calculate_ingredient_volumes` | Shared unit conversions and stage loss calculations. Reports liquid contributions, partial totals, and a loss-free batch-volume input for the draft solver. |
| Outside recipe evaluation | `evaluate_recipe` | Checks fixed ingredients or an inline RecipeDataV2 snapshot using shared gravity, ABV, nutrient and stabilizer calculations. |
| Recipe and nutrient calculations | existing `build_recipe_draft`, `explain_recipe` (hosted), `get_recipe` (authorized saved reads) | Use the existing draft solver to formulate against targets and authorized saved reads to retrieve existing recipes. |

Discovery includes 14 calculator tools, seven original tools and five public
community reads under the basic scope, for 26 tools. Granting account reads
adds seven more, for 33 tools.
Both fixed-recipe tools accept inline data using the basic scope. Explicit
`rackedVolume` and stabilizer scenario overrides default to `assumption`.
Set the volume's `source` or the scenario's `abvSource` to `measurement` for
actual readings or `recipeClaim` for values taken from the recipe.
Readings under `measurements` are labeled as measurements.

## Inputs, output, and units

Discovery schemas describe required inputs, defaults, numeric bounds and result
keys. Inputs are strict: unknown properties, identities, NaN/Infinity, negative
volumes, unsupported units and invalid combinations are rejected. Successful
standalone scalar calculators return `status: "ok"` and `result: { values, units, assumptions, warnings }`. The two fixed-recipe tools return structured stage and check results.
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

## Fixed recipes and draft inputs

For an outside recipe, use `evaluate_recipe` with its fixed ingredient amounts.
Include reported OG, fermentation FG, volume and ABV under `claims`. Use
`measurements` for readings the brewer actually took. Volume claims must name
their stage. OG claims can use SG or Brix. Fermentation FG uses SG and refers
to the end of primary fermentation, before sweetening. Comparison deltas
subtract the claim from the MeadTools estimate or comparable measurement.
A recipe's planned FG can be used in the model while its comparison remains
open until there is a measurement.

For an isolated addition, `calculate_ingredient_volumes` accepts this input:

```json
{
  "ingredients": [
    {
      "name": "Apple juice",
      "stage": "secondary",
      "amount": { "kind": "volume", "value": 32, "unit": "fl_oz" }
    }
  ]
}
```

The secondary contribution is 0.946352946 L. An explicit `rackedVolume` or
a primary formulation with `primaryLoss` is needed to resolve the post-addition
total. `packagingLoss` applies next. Supply an explicit zero when modeling no
loss. Native snapshots follow the builder's zero-loss defaults when their
loss settings are absent or disabled. Unresolved stages include field-level
reasons and known subtotals. Stage targets are comparisons and leave the
ingredient amounts fixed.

For a loss-free draft, use `draftBatchVolume` as `batchVolume` when the solver can
model the supplied ingredients the same way. It sums the primary and
secondary ingredient contributions before transfer losses. Keep the
original weight or volume basis, set each supplied ingredient role to
`fixed`, and use `allowWaterFill: false` for an all-fixed formulation. The
draft solver still needs its normal intake inputs. The draft and structured-input calculators derive weighed fruit volume from
mass and Brix-derived density.

For a draft with planned losses, pass the desired packaged yield as
`batchVolume` and supply the recipe builder's `lossAdjustment`. For example,
a 2 US gal target with `{ "enabled": true, "mode": "manual", "percentage": 50 }`
and no secondary additions solves for 4 US gal in primary. The draft stores the
loss setting. An optional `secondary` percentage applies after all additions.

The standard MeadTools model converts a weighed ingredient's Brix to SG,
then divides its mass in kilograms by that SG. This includes whole fruit
in primary and secondary. Use catalog or supplied Brix, or supply measured
density for a volume estimate. The stage loss applies to the modeled blend.
Use a separate displacement input when estimating physical headspace.
Plain water names such as spring water default to zero Brix. Supply Brix
when the liquid has dissolved sugar. Use the density model for fermentable
sugars. The `solid` kind is reserved for additions that contribute neither
modeled volume nor sugar.
Native snapshots preserve the builder’s stored ingredient volume when present.
If Brix is missing, volume can still resolve while gravity-dependent checks
remain unresolved. When a measured racked volume is supplied alongside
planned primary loss, the evaluator uses the measurement through all stages.
When a honey ingredient lacks Brix, the tool reports use of standard honey
as a proxy, including for cooked honey.

An explicit `targetOriginalGravity` sets primary OG. A `targetAbv` sets
finished ABV and lets the solver compensate for secondary dilution. If fixed
amounts and calculated backsweetening exceed the packaged target, the draft
preserves the formulation and reports the overage. An adjustable fill liquid
reserves space for backsweetening, including when transfer loss is zero.
Fermentation FG must be at or below the calculated primary OG. Draft nutrients use
the builder's estimated YAN offset from primary fruit by default. Set
`nutrients.offsetPpm` explicitly to substitute another estimate, including zero.

Send the whole formulation in one tool call. The two fixed-recipe tools accept
a single MCP request body up to 128 KiB. The route reads up to that bound
to identify the tool. Other MCP calls still have a 16 KiB limit.
Large calculator responses include stage totals and key estimates in text and
carry the full results in MCP structured content. Stage-specific stabilizer checks refer to the missing inputs on
their source volume or ABV check when either remains unresolved.

The nutrient calculation replaces the nutrient form's volume and SG with
the primary liquid volume and fermented gravity points (OG minus fermentation FG). Secondary additions dilute the finished ABV estimate under the
alcohol-free, unfermented addition model. Stabilizer scenarios can use a
measured volume and ABV at the selected stage even if the formulation is
incomplete. Native snapshots use their stored stabilizer pH, including the builder default.
Sulfite scenarios accept pH or requested ppm. Campden is the alternative
sulfite form. At 16% ABV the sorbate formula returns zero, and above 16% the
sorbate check reports that the formula is out of range. The zero result
marks the formula boundary. Stability requires separate evidence.

## Deterministic verification

`packages/recipe-agent/test/calculator-tools.test.ts` checks registration,
unique names, hosted/MCP parity without account access, typed schemas, original
formula expectations, conversions, rounding, boundaries and useful errors.
Core tests pin extracted calculation behavior. The existing offline MCP
permissions fixture invokes every calculator through the real SDK for both
scope grants, validates structured responses, and retains private-read denial
checks. No model calls or paid evaluation are involved.

After deployment, refresh discovery through the existing production custom
connection. Verify the 32 US fl oz example and an outside fixed recipe with
stage-specific claims, including a partial check and a resolved stabilizer
scenario. Record the client and results in the MCP client testing plan before
including the tools in marketplace submission material.

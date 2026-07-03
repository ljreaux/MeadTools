# Calculation boundaries

These rules describe the current recipe-derived calculation contract. Golden
tests protect them while the calculation kernel moves into shared packages.

## Golden fixture provenance

The fixtures in
`apps/web/lib/utils/__fixtures__/recipeDerivedFixtures.ts` were established
before the recipe-derived calculation graph was moved into `@meadtools/core`.

The process used to create them was:

1. Hand-author three representative `RecipeData` inputs: a traditional
   gallon-based recipe, a metric backsweetened recipe with nutrients and
   stabilizers, and an empty boundary case.
2. Run each input through the existing
   `calculateRecipeDerivedApiResponse` implementation.
3. Capture the exact returned `derived` object as a literal golden value.
4. Add tests that independently call the calculation function and compare its
   output with the captured literal.
5. Send one fixture through the `/api/recipes/derived` Route Handler and verify
   that its serialized response matches the same golden result.

The values were captured on 2026-07-02. At that point, the recipe, nutrient,
and stabilizer calculations still lived in `apps/web/lib/utils`. Gravity and
temperature primitives had already moved to `@meadtools/core`, with their own
parity tests.

The expected values are not generated dynamically during tests. That would
only prove that a function agrees with itself. Literal expected values provide
an independent snapshot of pre-extraction behavior.

When a golden test fails:

1. Compare the previous and new results.
2. Determine whether the change is an extraction regression or an intentional
   calculation correction.
3. For an intentional change, document the reason and affected contract.
4. Update the golden value only after that review.

## Canonical units

- Ingredient weight is normalized to kilograms.
- Ingredient and batch volume is normalized to liters.
- Recipe results are converted from liters to the recipe's preferred volume
  unit only at the output boundary.
- Nutrient calculations use either liters or US gallons as declared by
  `volumeUnits`.
- Additive conversion uses grams and milliliters as its internal base units.
- Specific gravity and Brix remain unitless numeric values.

## Precision and rounding

- Core gravity, volume, alcohol, and stabilizer results retain full JavaScript
  floating-point precision.
- Input strings are parsed at the calculation boundary; display formatting is
  not part of the calculation kernel.
- Nutrient target YAN is rounded to the nearest whole ppm.
- Automatically calculated yeast amount, Go-Ferm amount, and Go-Ferm water are
  rounded to two decimal places.
- Recipe nutrient volume and SG inputs generated from recipe state use three
  decimal places.
- Stabilizer pH is rounded to one decimal place before selecting the required
  sulfite ppm.

## Empty inputs

Empty numeric strings parse as zero. An empty ingredient list currently
produces zero volume, original gravity `1`, backsweetened final gravity `0`,
ABV `0`, and Delle `-668.962`. This behavior is preserved by a golden test; it
may only be changed intentionally with corresponding product validation and
contract updates. The in-process nutrient target is negative zero for this
case, which JSON serializes as ordinary zero.

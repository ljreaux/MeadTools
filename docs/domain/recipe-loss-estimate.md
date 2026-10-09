# Primary transfer loss estimate

Issue #437 adds an optional planning estimate for volume left behind when a
fermented primary batch is transferred to secondary. Existing recipes without
`dataV2.lossAdjustment` have loss adjustment disabled and retain their prior
calculation results. The feature does not rewrite stored recipes or brew data.

## Meaning of the percentage

The percentage applies to modeled **primary volume before secondary additions**:

`post-transfer primary volume = primary volume × (1 − loss percentage / 100)`.

Secondary additions are then blended into the remaining primary volume. A loss
of uniformly mixed fermented liquid does not itself change FG or ABV. When
secondary additions are present, the smaller fermented volume changes the
resulting backsweetened FG and ABV dilution. OG and nutrient calculations stay
on the primary volume before transfer.

## Optional secondary loss

A separate manual percentage, disabled by default, applies after secondary
additions: `estimated bottling volume = volume before bottling × (1 − secondary
loss percentage / 100)`. The manual allowance can be enabled independently of
primary transfer loss. It only changes estimated yield, not OG, FG, ABV, or
nutrient calculations. An optional button fills the manual value with a rough
ingredient suggestion: `round(5 + 60 × solid secondary ingredient volume /
volume before bottling)` percent. The percentage then stays manual as the
recipe changes. This uses the shape of the primary heuristic, but it is not
calibrated from the transfer records below, which do not measure bottling
yield. The actual packaged volume should be recorded in the brew tracker and
takes priority over a planning estimate.

## Automatic estimate

The initial rule is intentionally simple:

`round(5 + 60 × solid primary volume / total primary volume)` percent.

The 5% allowance represents lees and transfer handling. Solid primary volume
includes ingredients in the `fruit`, `dried fruit`, and `vegetable` categories.
Ingredients named as juice are treated as liquids even when their catalog
category is `fruit`. Water, honey, sugar, and juice contribute to the denominator but not to the
solid-volume term. If positive primary volume is unavailable, there is no
automatic estimate. Users can enter a manual percentage from 0% to less than
100%. Manual values stay fixed when ingredients change; estimated values
refresh when ingredients change. Reopening an unchanged recipe displays its
saved percentage. Switching back to estimated mode recalculates the current
automatic value.

This rule was informed by a read-only export of 18 de-identified brew tracker
transfer records. Ten records without primary fruit had about 5% median
apparent loss, while eight with primary fruit had about 32% median apparent
loss. The latter ranged from about 7% to 60%, and one fruit-free record showed
a volume increase. **None of the 18 records contained an earlier measured
starting volume.** The displayed starting volume may have been filled from the
recipe. These observations do not establish a reliable statistical prediction,
nor do they calibrate dried fruit or vegetables separately. The coefficients
are provisional planning assumptions and should be revisited when paired
measured volumes become available.

## Brew tracker

New brews copy the saved recipe data into their immutable recipe snapshot. The
planned post-transfer target uses the saved percentage. A recorded transfer
volume is a measurement and takes priority in actual brew calculations; the
estimated loss must not be subtracted from it again. Later secondary additions
remain outside the primary loss estimate. When secondary loss is enabled, the
tracker displays the estimated bottling yield and uses it to prefill packaging
only when no measured current volume is available. With a measured current
volume, the bottling calculator starts from that measurement and offers the
recipe estimate as an explicit alternative. The user decides whether the
remaining loss allowance still applies; no loss is silently subtracted from a
measurement.

When enabled, the recipe PDF adds primary volume, estimated lost volume, and
post-transfer volume as rows at the end of the primary ingredient table. The
top summary keeps the planned total volume. With loss disabled, those rows are
omitted. A brief estimate caveat sits below the table.

The primary caveat always points to the brew tracker for an actual transfer
measurement, even when the secondary estimate is also shown.
When secondary loss is enabled, the PDF also shows volume before bottling,
estimated secondary loss, and estimated bottling volume beneath the secondary
ingredients, or in a small separate table when there are no secondary
ingredients. Its short footer points to the brew tracker for actual yield.

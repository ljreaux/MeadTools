# Hosted Luna recovery test — October 18, 2026

Seven approved hosted turns completed using `gpt-5.6-luna`, medium reasoning,
eight allowed tool calls and ten allowed provider calls per turn. This tested the
[recovery and calculation changes](chatbot-recovery-improvements.md) through the
normal signed-in browser flow. No attachments, recipe saves or brew changes were
used. Product code stayed fixed during the batch. No turns were replaced or retried.

The calculation changes help, but this sample does not establish overall parity
with the saved native MCP baseline. The model still fails to preserve a primary
honey amount on an implicit saved-recipe revision, and the analysis answer has
presentation and coverage defects. More tool headroom did not resolve those issues.

## Results

| Scenario | Observed result |
| --- | --- |
| Saved recipe analysis | Correct eventual fermentation FG 0.996, 14.37% ABV, 4.219 L and detailed nutrients, but visibly talks through wrong FG candidates before correcting itself. Omits requested stabilizer doses and appends a calculator/wiki referral. |
| EC-1118 revision | Chooses standard EC1118 without asking about organic. Still does not complete: treats primary honey as solved against a gravity target and reports a water/volume conflict. The answer lists retained water and secondary honey but omits the original 1.5 kg primary honey. Preserves neither the full request nor a completed draft. Accurately explains advanced nutrient limitations. |
| Explicit fixed-amount follow-up (additional diagnostic) | Completes an unsaved draft with 3 L water, 1.5 kg primary honey, 225 g secondary honey, EC1118, fermentation FG 0.996, saved additives, TBE/three additions/Go-Ferm and pH 3.6. Independently recalculates to 4.219135 L and 14.368481% ABV. Warns that advanced nutrient settings cannot carry over exactly. |
| Brew review | Retrieves OG 1.100, subsequent 1.055 and latest 1.000; dates pH 3.42, notes missing recipe snapshot, unknown volume and no recorded additions. Recognizes one 1.000 reading cannot establish stable gravity. Minor answer inconsistency: identifies a hydrometer reading, then asks whether the instrument was a hydrometer. |
| Racking/stabilization follow-up | Contextual questions about repeat gravity, sediment, clarity, headspace, current volume, intended sweetness, fresh pH and free SO₂. Includes Hydrometers and Stabilization wiki sources. No mutation requested or performed through the UI. |
| Blueberry starting choices | Recommends one US gallon, about 10%, 1.010 sweetness, 3 lb secondary fruit, 71B, TOSNA/four additions/Go-Ferm and pH 3.5 assumption. Offers calculation after the requested recommendation; that question is appropriate here. |
| Cherry substitution | Completes an unsaved draft retaining 3 lb secondary fruit, 71B, TOSNA/four additions/Go-Ferm. Stored payload independently recalculates to 1.000000 gal and 9.999991% ABV. Finished FG is 1.010712, slightly above 1.010 because the fixed secondary fruit already supplies enough sugar; the answer discloses this and adds no honey backsweetener. |

Only two completed recipe payloads were produced, both unsaved. Recalculation
used the shared core calculator and recipe schema, not values copied from the
answer. The cherry draft's displayed water/honey quantities are rounded for use;
the stored quantities retain calculation precision.

## Comparison and limits

Against the [previous six-turn hosted Luna sample](chatbot-hosted-luna-model-test.md),
the cherry result improves from 1.027477 gal / 9.72204% ABV to 1.000000 gal /
9.999991% ABV. The new explicit fixed-recipe follow-up demonstrates that the
workflow now accepts the original saved amounts. It is a separately approved
seventh diagnostic and must not be counted as success for the failed matched
revision prompt.

The saved native MCP Luna run completed that matched revision after multiple
attempts. Hosted still needs the user to restate primary honey. Its brew answers
are useful in both runs. Both systems now share the corrected calculation engine,
but no new MCP model turns were run: comparisons use saved outputs from before
these changes. Native Codex also has different instructions and tool budgets.
There is no controlled evidence here that eight tools improve output versus seven;
none of these turns approached the eight-tool boundary, based on provider-call
counts. The deterministic regression verifies that boundary separately.

## Cost and completion

All seven messages and usage events completed with the requested served model.
Ledger cost reconciles exactly to token usage at the local immutable Luna rates.

| Metric | Result |
| --- | --- |
| Batch provider cost | $0.01797468 |
| Account credits consumed | 36 (1,671 → 1,635) |
| Cumulative provider spend | $0.31573635 of $2 ceiling |
| Provider requests, including titles | 33 |
| Median service latency, all seven | 10.862 seconds |
| Matched six cost, excluding diagnostic | $0.01509238 (previous $0.01559592) |
| Matched six median service latency | 12.242 seconds (previous 12.414) |

Service latency excludes title generation and browser overhead. This small sample
and cache differences do not establish a general speed or cost improvement.
The $0.50 batch cap was not approached. No additional provider turns are authorized
by this report.

## Remaining work

Investigate how the saved recipe is represented to the model during a revision:
explicit primary quantities should survive instead of becoming solved amounts.
Capture that behavior in a deterministic regression before changing it. Also
investigate recipe-analysis coverage of stabilizers and the appended generic
calculator referral. Avoid adding special EC1118 instructions or treating the
reasonable earlier organic-variant question as the core failure.

The 356 deterministic tests, typechecks, targeted lint and contract generation
passed before this provider batch. This report does not claim those checks
prevent variable model output. No product changes were made during the batch;
no PR, commit, push or deployment was created.

Local ignored evidence is under `.codex/454-comparison/`, with prefix
`hosted-luna-recovery-`: sanitized profile, settled evidence, summary, visible
transcripts, recipe/brew screenshots and final screenshot, and independently
recalculated draft verification. The saved MCP baseline remains unchanged.

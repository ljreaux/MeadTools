# Hosted multi-step recipe evaluation plan

Status: completed after explicit approval for four provider turns. Used
GPT-5.6 Luna, medium reasoning, minimal
orchestration, the existing eight-tool limit and the same local account fixture.
Expected provider cost is below $0.10, with a $0.25 batch cap inside the existing
$2 cumulative evaluation ceiling ($0.36421493 spent before this batch).

Run the following four turns in one fresh conversation. Do not attach a recipe,
save a draft or change a saved account record. Preserve prompts unchanged so
failures remain useful evidence. Do not add replacement turns automatically.

1. “Find my saved recipe Metric Traditional Test and make an unsaved draft scaled
   to 10 liters total finished volume, including the secondary honey. Keep the
   same ingredient proportions, fermentation FG, yeast, nutrient schedule and
   stabilizer choices. Scale the additives too. Tell me any saved settings that
   cannot carry over.”
2. “Now halve that draft to 5 liters total and switch the yeast to Lalvin EC-1118.
   Keep the other choices and proportions. Leave it unsaved.”
3. “Revise this 5-liter draft to 10% finished ABV. Keep the secondary honey amount,
   fermentation FG and EC-1118. You may adjust primary honey and water to meet
   the target. Show the resulting amounts and calculated finished sweetness.”
4. “Actually make it 1 liter total, but use exactly 3 liters of water and keep the
   honey amounts from that draft unchanged. Don't silently change those amounts.”

## Acceptance checks

- First turn must find and read the account recipe, then build a real unsaved
  draft. A text-only recipe or arithmetic without a successful calculator result
  does not count. No explicit scaling tool exists in the hosted tool set: the
  model must assemble the transformed recipe inputs.
- Compare ingredient and additive ratios against the original saved recipe,
  using its total volume (4.219135 L), not primary volume (4.060117 L). Accept
  practical quantity rounding, with finished volume within 0.01 L and gravity
  within 0.0001. Verify fermentation FG remains 0.996 and ingredient stages stay
  intact. Nutrient/stabilizer doses must be recalculated, rather than copied as
  static totals. Unsupported advanced settings must be disclosed.
- Second turn must halve the existing draft quantities, preserve secondary
  additions and additives, resolve EC-1118 through catalog facts, and recalculate
  its nutrient requirement without losing the accepted recipe context.
- Third turn must preserve the fixed secondary honey, fermentation FG and yeast,
  while solving primary honey/water. Independently recalculate from stored draft
  data: total volume within 0.01 L and finished ABV within 0.05 percentage point
  of the requested targets. Distinguish fermentation FG from finished sweetness.
- Fourth turn must identify the impossible volume constraint, avoid claiming a
  completed valid 1 L draft, and ask a focused resolution question. The previous
  valid draft should remain available; do not silently overwrite fixed amounts.
- Inspect stored recipe data and rerun the shared calculator for every successful
  draft, not just the model's prose. Record tool steps, latency, credits, provider
  usage/cost, and whether extra clarification was necessary. Verify no draft was
  saved to the recipe library. Report failures before making behavior changes;
  any later fix requires a deterministic regression test and separate retest scope.

The evaluation isolates composition, unit/quantity reasoning, multi-turn state,
constraint solving and refusal of an impossible request. It does not establish
general reliability or cover every recipe type.

## Results

All four turns completed successfully without clarification, retries or replacement
turns. Independent checks parsed the stored draft recipes and reran the shared
calculator; no behavior changes were made during the evaluation.

| Turn | Result | Calculator volume | Finished ABV | Latency | Credits |
| --- | --- | --- | --- | --- | --- |
| Scale saved recipe | Pass | 10.000296 L | 14.368333% | 19.454 s | 7 |
| Halve and switch yeast | Pass | 5.000147 L | 14.368330% | 8.304 s | 5 |
| Lower ABV, preserve secondary honey | Pass | 4.999999 L | 10.000000% | 9.415 s | 6 |
| Impossible volume | Pass: explained conflict | Prior valid recipe retained | Prior valid recipe retained | 7.665 s | 4 |

The first turn searched/read the saved recipe, looked up catalog data and built a
draft (7 provider calls). It preserved primary/secondary proportions within 0.001
L/kg and scaled additive quantities within 0.1% or 0.001 g. These tolerances allow
practical rounding; the model's additive arithmetic was not exact. It disclosed
unsupported advanced nutrient settings. The second turn halved ingredients and
additives exactly and changed nitrogen requirement from Medium to Low with EC1118.
Both retained TBE, three additions, Go-Ferm, K-meta and pH 3.6.

The third turn used 1.229975 kg primary honey and 3.942268 L water, keeping
266.65 g secondary honey unchanged. Calculated finished FG was 1.011790 versus
fermentation FG 0.996. The final conflict response offered changing the total
volume or allowing ingredient quantities to change. Its unsuccessful calculation
did not replace the prior valid recipe data, although the attempted inputs were
recorded as a new draft revision. All revisions had no saved recipe ID.

The settled account balance moved from 1,511 to 1,489 credits. Total provider cost
was $0.01137026 across 15 provider calls; cumulative tracked evaluation spend is
$0.37558519. The local orchestration setting was restored to guided after testing.
No PR, deployment, recipe save or extra model turn was performed.

Evidence is retained locally under `.codex/454-comparison/hosted-luna-multistep-*`:
sanitized configuration, transcripts/ledger, stored drafts, independent
calculations, automated acceptance checks and UI screenshots. The acceptance
script checks ingredient stages by identity rather than array position, since
the calculation tool reordered ingredients in the ABV-solving revision.

This is positive evidence for multi-step composition on this fixture, including
cross-turn context and fixed-quantity constraints. It remains a single four-turn
sample rather than a broad reliability estimate. More varied recipes, losses,
fruit substitutions and brew-timeline diagnosis remain untested by this batch.

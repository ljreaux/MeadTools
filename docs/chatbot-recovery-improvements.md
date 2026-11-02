# Hosted recovery and calculation improvements — October 18, 2026

Status: implemented locally with deterministic verification and seven approved
hosted provider turns completed. See [provider results](chatbot-luna-recovery-model-test.md).
No PR, commit, push or deployment has been made.

## Findings and changes

The [hosted Luna test](chatbot-hosted-luna-model-test.md) showed improved planning
and lower cost, but the earlier traces exposed two application blockers and
calculation drift shared by MCP and hosted chat.

- Hosted explicit draft requests returned a deterministic missing-input question
  before the model saw the tool result. That early return and its renderer are
  removed. Missing inputs can now be resolved with known choices or catalog
  tools in the same turn, or become one natural question when user input is needed.
- Calculation errors also ended the turn before recovery. Only successful recipe
  results now bypass the model. Failed calculations return to the existing bounded
  loop with concise guidance to correct arguments or ask which genuinely conflicting
  constraint may change. Completed drafts retain their deterministic renderer.
- The fixed-volume guard rejected both exact fits and the saved fixture's rounded
  4.219 L total. It now rejects genuine overfill, allowing 1 mL for displayed volume
  rounding without changing any supplied ingredient amount.
- A legacy honey category could switch an explicitly weighed ingredient to volume
  basis. Explicit weight/volume measurement choices now take precedence over
  category-based display preferences. No saved record or catalog category is edited.
- Calculated amounts were rounded to tenths in the authoritative payload, changing
  finished volume and ABV. The shared workflow now retains six-decimal quantities
  for calculation; hosted rendering still rounds amounts for practical display.
- A retained adjustable role could make a quantified fermentable participate in a
  solver despite its explicit amount. All supplied amounts now take fixed precedence;
  genuinely solved quantities must omit the amount. Incompatible targets produce
  the existing warning instead of silently changing the supplied amount.
- First-message requests to calculate a new or unsaved draft now stay in the
  recipe workflow instead of being redirected to the standalone ABV calculator.
  Plain numeric ABV questions retain the deterministic calculator path.
- Hosted defaults allow eight tool calls, up from seven. Ten provider calls and all
  existing token/input/output budgets remain. The previous Luna sample did not hit
  seven, so this is recovery headroom, not a claimed explanation for earlier failures.

The change does not add a forced yeast path or a new draft retry/default-injection
prompt. It removes application short circuits and shortens the generic incomplete-
draft instruction. Ownership checks, confirmation flows, accounting and provider
bounds continue through the existing paths.

## Deterministic evidence

Regression cases were observed failing before their fixes. They cover catalog
recovery from missing yeast; a genuine missing user choice; correction of a
model-supplied full gallon of fill water; asking about a true fixed-amount conflict
without altering it; provider-call budget enforcement; exact/rounded fixed recipes;
legacy measurement-basis preservation; finished yield/ABV for blueberry and cherry;
explicit amounts beside adjustable roles, the eight-tool boundary, and first-message
draft routing with a standalone-ABV control. A true overfill control stays invalid.

Offline replays of the captured inputs now return:

| Captured input | Result after change |
| --- | --- |
| Fixed saved-recipe EC-1118 revision | Completed recipe, retaining 3 L water, 1.5 kg primary honey and 225 g secondary honey; 4.219135 L, 14.3685% ABV. |
| Native Luna blueberry draft | 0.999999 gal and 9.999993% ABV. Previously about 1.021476 gal and 9.781934% ABV. |
| Native Luna cherry substitution | 1.000000 gal and 10.000009% ABV. Previously about 1.025197 gal and 9.745060% ABV. |

These are deterministic workflow replays, not new model turns or proof that a
model will supply the right arguments. Advanced saved nutrient settings remain
outside the editable draft contract; no replay claims to preserve custom caps,
contributions, provided YAN or manual yeast amount.

Validation: 216 web tests, 58 recipe-workflow tests, 38 recipe-agent tests and
44 API-contract tests passed (356 total), plus web/workflow typechecks, targeted
lint and whitespace checks. The authenticated MCP preflight returned all 12 tools
and successful private-account recipe access without a model call. Contract and
OpenAPI generation passed with no generated diffs.

Local ignored evidence is under `.codex/454-comparison/`: `recovery-before.log`,
`chat-recovery-before.log`, `amount-role-before.log`, the `recovery-*-tests.log`
files, and `recovery-offline-replays.json`.

## Approved provider verification — completed

The user approved seven hosted turns using GPT-5.6 Luna at medium reasoning and the new
8-tool/10-provider-call budgets. Use three fresh conversations with the six
matched prompts from the previous hosted/MCP runs, plus a third saved-recipe turn:

> Use the standard Lalvin EC1118. Keep 3 L water, 1.5 kg primary honey, 225 g
> secondary honey, and the other saved recipe choices. Calculate an unsaved draft
> and explain which nutrient settings cannot carry over.

The six matched turns compare practical output with saved hosted/native MCP Luna
results. The separately identified seventh turn explicitly exercises the fixed-
recipe revision even if the model first asks about the organic variant. The
variant clarification alone is not treated as a serious quality failure.

Review completed drafts, preserved amounts/stages, nutrient limitations, useful
questions, tool recovery, final volume/ABV, latency and ledger cost. Keep the
normal browser/authentication/credit flow, never save a recipe or change a brew,
and do not replace or automatically rerun a failed provider turn. Shared workflow
changes mean this measures the combined iteration rather than a prompt-only cause.

Expected provider cost is below $0.25, with a $0.50 batch budget inside the existing
$2 cumulative ceiling; $0.29776167 has been used before this batch.
Hosted turns also consume MeadTools User's credits. Check settled cost between
turns and stop with headroom rather than expanding the approved batch. Reuse saved
MCP results; no new MCP model turns are included in this batch.

No PR, commit, push or deployment is part of this iteration.

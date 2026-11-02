# Same hosted model with minimal instructions and MCP

The minimal setup answered the saved-recipe analysis that repeatedly failed in
the hosted bot. It did not complete either requested recipe draft. This supports
simplifying hosted orchestration, but does not show that deleting all guidance
is enough to match the native MCP agent's performance.

## Experiment

On October 18, 2026 (America/Chicago), the user approved six API turns with the
exact hosted snapshot, `gpt-5.4-mini-2026-03-17`, the existing key and $2 total
API ceiling. The only system prompt was:

> Only answer questions about mead, brewing, and MeadTools. Please use the available MeadTools tools.

Three fresh two-turn conversations used the original six prompts from
[the comparison pilot](chatbot-comparison-pilot.md). The relay discovered the
actual 12 MCP tool descriptions and input schemas and forwarded calls/results
unchanged. MCP tool guidance remained available. No Codex inference, repository
instructions, hosted policy, intent routing, forced tools, default injection,
recipe-state injection, automatic reruns or answer rewriting was used.

The same OpenAI Responses transport was retained, with low reasoning while
tools were available and the hosted runtime ceilings: seven tools, ten provider
calls, 4,000 output tokens per completion, 8,000 combined output tokens, 60,000
context characters and 60,000 cumulative provider tokens per turn. The model
returned the exact pinned snapshot on every completion. Titles were not generated.

## Observations

| Prompt | Minimal MCP result | Most recent hosted result |
| --- | --- | --- |
| Analyze Metric Traditional Test | Successful account lookup and calculator walkthrough: 14.37% ABV, gravity, volumes, nutrients and stabilizers. Two tool calls; 7.6 seconds. | Provider-call limit; no analysis. |
| Revise it to EC-1118 | Looked up yeast, disclosed unsupported nutrient settings, but failed to complete the draft after input-validation and volume errors. | Draft feasibility error; no completed revision. |
| Review Active Test Brew | Read the brew and qualified uncertainty. Did not fetch the timeline, omitted the measured OG and exposed raw IDs, enum names and timestamps. | Read the brew and timeline, including OG; incorrectly described an older pH as current. |
| Racking/stabilization follow-up | Fetched wiki evidence and applied it to the known readings and missing stability evidence. Its 24-hour stabilization statement is present in the fetched page. | Retrieved wiki guidance, but gave a more generic answer. |
| Recommend a simple blueberry mead | Made recommendations, but failed two draft attempts; returned a misleading explanation that one pound of fruit crowds a one-gallon batch. No completed draft. | Produced an unsaved draft, but used six pounds of fruit and exceeded yeast tolerance in primary. |
| Substitute tart cherries and calculate | Failed the draft and asked for another choice rather than completing the requested calculation. | Produced an unsaved cherry draft, retaining the heavy fruit load and yeast-tolerance warning. |

All six turns returned a visible answer. There were 24 provider completions and
18 MCP tool calls; individual turns took 4.0–14.2 seconds. No completed recipe
draft was produced by the minimal setup. No recipes or brew changes were saved.

## What the tool trace explains

The model repeatedly combined `role: fill_liquid` with an explicit water amount.
For example, it requested one gallon of water plus honey and secondary fruit in
a one-gallon finished batch. The workflow deliberately honors explicit amounts
as fixed constraints, even when a model labels the ingredient as adjustable.
Its resulting error blamed fruit volume, and the model repeated that explanation
instead of identifying the water allocation problem.

Offline, deterministic replays of the three final failed draft calls all returned
`recipe` after removing only the explicit amount from `fill_liquid`. These are
diagnostics, not model reruns or replacement answers. In the saved-recipe case,
making water adjustable also relaxes an actual saved ingredient constraint, so
that counterfactual is not evidence of exact recipe preservation.

The trace also captured avoidable argument errors: a null optional catalog ID,
an omitted fermentation FG and an invalid Go-Ferm enum. The model recovered from
those validation errors within the approved turns, but not from the volume errors.

The next useful changes belong in clear tool contracts and accurate errors,
alongside a simpler hosted loop. Adding more narrative policy would leave the
confusing role/amount interaction in place. Keep server-side ownership checks
and calculation validation, which were unchanged in this experiment.

## Limits and evidence

This is a six-turn qualitative comparison. It changes both policy/orchestration
and the exposed MCP tool interface relative to hosted chat; it is not a
prompt-only controlled experiment. There were no unrelated-topic or adversarial
tests, and the stored hosted conversations were not rerun for this batch.

Using the repository's versioned model prices, calculated provider cost was
**$0.05692545**, bringing the total across these API experiments to
**$0.17099040**. This is token-based cost accounting, not a provider invoice.
The direct API experiment did not charge MeadTools chat credits. Native Codex
model usage from the earlier comparison is separate.

The local ignored evidence directory is `.codex/454-comparison/minimal-mcp/`:

- `run.json`: exact prompt, model, settings, tool definitions, messages, tool
  arguments/results, usage and cost. Credentials and hidden reasoning are excluded.
- `visible-transcripts.md`: readable conversations and submitted tool arguments.
- `deterministic-diagnostics.json`: original and counterfactual workflow results.

Offline relay checks and authenticated tool-discovery/account-read preflights
passed before model calls. Product code and the hosted bot were not changed
during this experiment. No PR, commit or push was made.

## Implementation prepared for the next iteration

Following the user's request to make updates, the working branch now:

- Generates the hosted/MCP draft-tool schema from the shared workflow schema,
  removing the separate hand-written draft schema. Descriptions distinguish
  finished volume from primary/water volume, fermentation FG from finished
  sweetness, and fixed amounts from calculated top-ups. Host-owned catalog
  alcohol tolerance and legacy undosed-additive input remain unadvertised.
- Explains explicit fill-water conflicts without dropping a supplied amount or
  blaming a small fruit addition. Mixed fixed-ingredient conflicts are described
  as combined constraints; a fruit-only diagnosis is reserved for an actual
  fruit-only or independently excessive fruit constraint.
- Uses automatic initial recipe/yeast tool choice and removes the application
  retry that forced a draft after a model answer while injecting recipe defaults.
- Stops treating the noun “stabilizers” in a saved-calculation walkthrough as a
  stabilization process request. Actual process requests still retain wiki
  retrieval, and catalog recovery, limits, ownership and confirmation remain.

Deterministic regressions were added and observed failing before the fixes:
blueberry and cherry fixed-water failures, mixed water/fruit error attribution,
shared tool-schema guidance, the exact saved-recipe walkthrough and absence of
an automatic draft retry. Older tests that asserted forced dispatch now verify
model-selected calls and preservation of the resulting recipe choices.

This is a partial simplification, not a replacement of the entire hosted loop.
The next explicitly approved batch is recorded below. It measures the combined
changes; it does not isolate schema guidance from orchestration changes.

Validation for these implementation changes: 204 web tests, 52 workflow tests,
38 recipe-agent tests and 44 API-contract tests passed (338 total), along with
all three typechecks and targeted web lint. Contract and OpenAPI generation
completed with no generated diffs. A fresh authenticated MCP preflight passed
with all 12 tools and the updated tool schema; it sent no model request.


## Updated comparison: October 18, 2026, iteration 1

The user explicitly approved 12 turns: six minimal MCP turns and six hosted UI
turns, using `gpt-5.4-mini-2026-03-17`, low reasoning while tools are available,
expected API cost under $1 and the existing $2 cumulative ceiling. Both sides
used the same six prompts above, in three fresh two-turn conversations. No UI
recipe/brew attachments were used. The authenticated MCP connection exposed all
12 tools and could read the fixture account before any model call. The relay's
offline checks passed. All completions served the pinned model. No product code
changed during the batch and no failed turn was replaced or rerun.

| Prompt | Updated minimal MCP | Updated hosted bot |
| --- | --- | --- |
| Analyze saved recipe | Completed a detailed calculator walkthrough, including nutrient and stabilizer quantities; 3 tools. | Completed the walkthrough, replacing the previous call-limit failure. Gave totals and nutrient context but omitted exact dose quantities. |
| Change yeast to EC-1118 | Looked up EC-1118 and disclosed advanced nutrient carryover limitations, but the fixed ingredients/volume/gravity constraints prevented a draft. | Returned the same fixed-ingredient calculation error, without the requested nutrient carryover explanation. No draft. |
| Review brew history | Read list/detail but skipped the timeline. Omitted measured OG, exposed raw identifiers, and offered to fetch the timeline afterward despite the original request. | Retrieved timeline evidence, including measured OG 1.100 and pitch note. Still called the older recorded pH “currently 3.42.” |
| Racking/stabilization follow-up | Retrieved fermentation/stabilization pages and related them to known readings and missing stability evidence. Its missing addition-history context follows the skipped timeline. | Retrieved stabilization guidance, but response was largely generic rather than tied to this brew's documented readings. |
| Blueberry starting choices | Proposed 2 lb fruit and a 1.010 fermentation FG; an incomplete draft request returned required nutrient-plan inputs. Broad yeast search returned no matches and was not repaired within this turn. | Recommended dry fermentation, stabilization and later light backsweetening, with 2–3 lb fruit. Did not choose a specific yeast and asked another preference question. No draft was required by this first prompt. |
| Calculate cherry substitution | Completed an unsaved draft: 2 lb fruit, 2.2 lb honey, Lalvin 71B, TOSNA, calculated 9.77% ABV. Calculated volume is 1.020 gal, although the answer calls it one gallon. | Stopped at “needs yeast brand and strain”; no completed draft despite permission to recommend sensible starting choices in the preceding turn. |

The MCP cherry result is a calculation completion, not an unqualified recipe
success. It assumes lightly sweet mead by fermenting to 1.010 with 71B at about
10% ABV and does not explain how that FG will be reliably achieved or maintained.
The model chose the correct adjustable water role without an explicit quantity,
and the old one-gallon-water-plus-fruit conflict did not recur. Its saved-recipe
revision instead used fixed amounts and the finished volume, but still failed
reconciliation. Improved error wording alone does not solve exact recipe revision.

All six turns on each side returned visible answers. Minimal MCP used 22 provider
completions and 16 tools, taking 5.0–10.4 seconds per turn. Hosted usage records
report 26 provider calls across six completed generations; these include its
normal title-generation overhead, so this is not a tool-call comparison.

Token-based provider cost was **$0.06008040 MCP** plus **$0.05109495 hosted**,
**$0.11117535 for this batch**. Hosted used **93 chat credits**, from 1,794 to
1,701. Cumulative API experiment cost is **$0.28216575**, below the $2 ceiling.
Native Codex allowance from the older baseline remains separate. These amounts
use the repository's versioned token prices and are not provider invoices.

The evidence supports mixed progress: hosted account analysis recovers, MCP
fruit drafting recovers, the exact saved-recipe revision remains broken on both,
and the hosted fruit draft regresses to an avoidable clarification. A six-turn
single sample does not establish a general winner or prove a prompt-only cause.
The next implementation targets are model recovery from missing nutrient choices,
exact fixed-recipe editing, clearer timeline discovery, and realistic handling
of finished sweetness. Capture deterministic regressions before fixing observed
failures; do not add more paid turns without approval.

Preserved local evidence under `.codex/454-comparison/`:

- `minimal-mcp-iteration-1/run.json` and `visible-transcripts.md`: complete MCP
  tool arguments/results, visible answers, usage, model and cost.
- `hosted-iteration-1-evidence.json` and `hosted-iteration-1-visible-transcripts.md`:
  all six persisted hosted responses, completion status and usage metadata.
- `hosted-iteration-1-{recipe,brew,exploration}.txt`: browser-visible transcripts.
- `hosted-iteration-1-final.png`: final hosted clarification and credit balance.

No recipes were saved or brew records changed. No PR, commit or push was made.


A subsequent six-turn GPT-5.6 Luna/medium native MCP comparison and offline
hosted failure investigation are recorded in
[the updated practical comparison](chatbot-luna-hosted-comparison.md).

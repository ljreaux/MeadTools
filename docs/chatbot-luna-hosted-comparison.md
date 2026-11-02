# Updated MCP versus hosted comparison — October 18, 2026

GPT-5.6 Luna at medium reasoning gave a more complete practical MCP experience
than the saved GPT-5.4 mini hosted run on these six prompts. It completed the
saved-recipe revision and both fruit drafts, read the brew timeline, and gave
more batch-specific follow-up guidance. This is a small qualitative sample,
not proof that every difference comes from the model.

## Setup and authorization

The user approved six new MCP turns with GPT-5.6 Luna at medium reasoning after
being told that the six saved hosted results would be reused. The run used the
desktop-bundled native Codex CLI, authenticated to local `meadtools-dev`, with
private account reads. Model usage came from Codex allowance. No additional
hosted or direct API evaluation calls were made. API experiment cost therefore
remains $0.28216575 against the existing $2 ceiling; hosted credits remain at
the last observed 1,701, with no new charges from this run.

The [same six prompts](chatbot-minimal-mcp-comparison.md) ran in three fresh
native conversations, with the second prompt resumed in each conversation.
The runner instructed the model to use only MeadTools MCP tools/server guidance,
preserve choices, and avoid repository/database/browser/credential access or
saving changes. Shell, apps, browser, computer and multi-agent features were
disabled. The CLI requested `gpt-5.6-luna` and medium reasoning; its event stream
records successful turns and usage, not a provider snapshot identifier.

This comparison represents two different user experiences: native Codex with
MCP versus hosted chat. The native context, reasoning, instructions and tool
budget differ from hosted. In particular, native turns were not capped at the
hosted limit of seven tool calls. Product code stayed unchanged during the
batch. There were no replacement or extra turns.

## Results

| Prompt | Luna + native MCP | Saved hosted result |
| --- | --- | --- |
| Saved recipe walkthrough | Detailed analysis of gravity, volumes, nutrients, stabilizers and assumptions; 22.46 seconds. | Completed, with less dose detail. |
| EC-1118 revision | Recovered after four draft attempts, corrected a legacy honey category, returned a draft and explained nutrient changes/unsupported settings; 34.82 seconds. | Ended at the fixed-volume calculation error; no revision or nutrient carryover explanation. |
| Brew review | Read the timeline, including OG 1.100, pitch note and absence of additions in visible history; distinguished the latest 1.000 sample from a confirmed FG; 16.27 seconds. | Also read the timeline, but described the old recorded pH as current. |
| Racking/stabilization | Applied fetched guidance to this batch, missing gravity stability, volume, vessel/headspace and potentially stale pH; 19.01 seconds. | Mostly generic fetched stabilization guidance. |
| Blueberry starting choices | Catalog-backed DV10, 2 lb secondary fruit, dry fermentation and calculated backsweetening to 1.012; completed draft; 20.07 seconds. | Reasonable broad recommendations, but no concrete yeast choice. A completed draft was not required by this first prompt. |
| Cherry substitution | Preserved the chosen plan and returned a recalculated draft: 9.745% ABV, finished FG about 1.012; 7.80 seconds. | Ended asking for yeast brand/strain instead of completing the draft. |

Six visible answers were completed with 34 MCP tool attempts. Five attempts
returned concurrent-call errors and were recovered within the same turns;
these are transport failures, not five extra user turns. Recipe analysis, brew
follow-up and blueberry planning each used eight tool attempts, exceeding the
hosted seven-tool budget. The saved-recipe revision used five tool attempts.
More room to retrieve/recover is part of this practical comparison.

The drafts are not flawless. Blueberry and cherry calculations return about
1.021 and 1.025 gallons respectively for a one-gallon request. Luna described
them as approximate one-gallon drafts and reported the lower-than-target ABVs.
The workflow rounds calculated measurement-basis amounts before recomputing
volume and ABV; that can change the requested yield. This affects both clients.

The final saved-recipe revision retains displayed amounts of 3 L water, 1.5 kg
primary honey and 225 g secondary honey, with 4.219135 L derived total volume.
However, it got there by changing the fixed water input into adjustable fill,
not by a clean exact-edit operation. It also corrected secondary honey's legacy
`water` category to `sugar`, after the earlier draft's measurement basis distorted
its volume. These recoveries help the user but expose workflow limitations; they
should not require model improvisation.

## Hosted investigation: two reproduced causes

### 1. The application cuts off recovery from missing inputs

In `apps/web/lib/ai/chat-service.ts`, an explicit draft request takes the
`directRecipeNeedsInputAnswer` branch immediately after `build_recipe_draft`
returns `needs_input`. That branch returns before adding the tool result to the
model conversation. The model never gets a chance to search for the missing
yeast in that turn, even though the ordinary loop can allow it.

An offline scripted-client replay using the exact hosted fruit conversation
and a draft missing yeast brand/strain reproduces the visible message after
exactly one client dispatch. The fake client would fail if a recovery completion
were attempted; no real model was involved. This explains a concrete application
failure, rather than merely speculating that the model is too weak.

Recommended change: return incomplete draft results to the normal bounded model
loop and let it choose a catalog lookup or a useful user question. Remove the
special explicit-draft early return. Do not add another forced yeast route or
silently inject a yeast. Preserve the existing tool/provider/token budgets.
A deterministic regression should script missing yeast → catalog selection →
completed draft, and another should confirm that genuinely unknown user choices
can still end in a concise question without looping indefinitely.

### 2. A shared fixed-volume guard rejects an already complete recipe

`fixedIngredientVolumeConflict` in
`packages/recipe-workflows/src/build-recipe-draft.ts` rejects fully fixed
ingredients when their total is greater than or equal to the requested volume
minus 0.000001 L. It does not distinguish fitting, fully specified inputs from
an actual overfill requiring an adjustable ingredient.

The saved fixture's amounts imply 4.2191343307 L. Its displayed 4.219 L target
is only 0.1343 mL smaller. Offline replay also fails when the target is replaced
with the exact full-precision ingredient volume, demonstrating that this is not
just display rounding. Separately, hosted's `directRecipeToolAnswer` immediately
returns calculation errors to the user, so the model cannot attempt recovery.

Recommended change: distinguish validation of a fully fixed composition from
solving adjustable amounts. Accept a composition that fits within an explicit
calculation/measurement tolerance, calculate its actual results, and preserve
all supplied amounts. Genuine overfills must still fail. Avoid solving this by
having the assistant relax the user's water constraint. Add regressions for exact
fit, the captured rounded fixture, genuine overfill, and preservation of primary
and secondary amounts. Let recoverable errors reach the model loop where useful,
without forcing retries of real infeasible constraints.

## Other improvements, after those two

- Keep full-precision calculation quantities authoritative when rounding display
  measurements, or explicitly reconcile the final rounded recipe against yield
  and ABV targets. The existing paired conversion does not preserve the target
  when the rounded measurement basis is used for calculation.
- Preserve a supplied amount's measurement basis when normalizing legacy
  ingredient categories; correcting the saved honey category should not be a
  model responsibility.
- Use the already fetched brew context in follow-ups, and keep measurement dates
  visible so an old pH is not presented as a current measurement.
- Review policy and post-tool instructions together. Hosted still adds detailed
  instructions after every tool, and several paths terminate before model
  recovery. Simplifying the opening prompt alone cannot remove these behaviors.

The first iteration should address the two reproduced blockers, with deterministic
regressions before claiming either fixed. The same-model comparison is then useful
for isolating orchestration progress; this newer-model MCP run remains the practical
experience benchmark. Another real-model batch requires separate approval.

## Preserved evidence and limits

Ignored local evidence under `.codex/454-comparison/`:

- `mcp-56-iteration-1-{recipe,brew,exploration}-{1,2}.json`: requested model,
  prompts, completed MCP calls, answers, timing and usage. Credentials and hidden
  reasoning text are excluded.
- `mcp-56-iteration-1-visible-transcripts.md` and `mcp-56-iteration-1-summary.json`:
  readable exchanges, submitted arguments and compact metrics.
- `hosted-iteration-1-evidence.json`: the six previously completed hosted turns.
- `hosted-iteration-1-offline-investigation.json`: deterministic early-return and
  fixed-volume reproductions; these are diagnostics, not additional model turns.

The investigation adds documentation and ignored evaluation artifacts, not a
product fix. No recipes were saved, no brew records changed, and no PR, commit
or push was made. No winner score was generated; the findings above come from
reviewing the actual conversations and tool results.


The subsequent [hosted Luna model test](chatbot-hosted-luna-model-test.md) keeps
the hosted tools and instructions and compares Luna/medium against the saved
mini/low hosted baseline, including actual cost, latency and draft verification.

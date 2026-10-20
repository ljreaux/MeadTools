# Hosted model comparison — October 18, 2026

Luna at medium reasoning is a promising hosted option in this six-turn sample:
it costs about 69.5% less than the previous hosted mini run, gives more concrete
planning and batch-specific guidance, and completes the cherry draft. It takes
longer and still does not complete the saved-recipe yeast revision.

## Setup

The user explicitly approved six hosted turns using `gpt-5.6-luna` at medium
reasoning, expected cost under $1, within the existing $2 cumulative API ceiling,
and using MeadTools User's chat credits. The same six prompts from the earlier
[comparison](chatbot-minimal-mcp-comparison.md) ran through the normal local
hosted-chat UI in three fresh conversations, without attachments. The comparison
is against the saved hosted `gpt-5.4-mini-2026-03-17` / low-reasoning run.

The model and reasoning changed together. Hosted tools, policy, per-tool
instructions, forced wiki retrieval, input normalization, deterministic draft
rendering and existing early-return behavior were unchanged. Budgets stayed at
seven tools, ten provider calls, 4,000 output tokens per completion, 8,000 total
output tokens, 60,000 serialized input characters and 60,000 cumulative provider
tokens per turn. Title generation remained tool-free with no reasoning.

Preparation added an operator-controlled low/medium reasoning setting and an
immutable Luna price snapshot. The local database received that pricing row;
no schema change or reset was needed. Prices were verified from the
[official Luna model page](https://developers.openai.com/api/docs/models/gpt-5.6-luna):
$0.20 uncached input, $0.02 cached input and $1.20 output per million tokens for
standard short-context requests. The application's bounds keep these requests
below the long-context pricing threshold. A read-only model metadata request
confirmed API access before the six generation turns.

The temporary local model/reasoning overrides were restored after the test:
`gpt-5.4-mini-2026-03-17` / low. No default-model switch, deployment or PR occurred.
The reusable reasoning setting and pricing support remain in the working branch.

## Observed results

| Task | Previous hosted mini / low | Hosted Luna / medium |
| --- | --- | --- |
| Saved recipe analysis | Completed but omitted exact nutrient/stabilizer amounts. | More detailed gravity, volume and nutrient amounts, with estimates distinguished from measurements. Still omitted calculated stabilizer doses and linked the calculator instead. |
| Revise to EC-1118 | Calculation error; no draft or nutrient carryover explanation. | Explained the advanced nutrient limitations, but asked standard versus organic EC-1118 rather than choosing the plainly requested standard strain and completing the revision. No draft. |
| Brew history | Read the timeline and OG; described old pH as current. | Read history and OG, dated the pH, and distinguished no logged additions from proof that no additions happened. |
| Racking/stabilization | Mostly generic guidance. | Related guidance to the single 1.000 reading, missing stability evidence, batch state and missing volume/yeast details. |
| Blueberry starting plan | Broad recommendations without a specific yeast; another preference question. | Chose catalog-backed Lalvin 71B, three-addition TOSNA, dry fermentation and finished FG 1.010. Retained a structured plan. Asked whether to calculate, appropriate to this recommendation prompt. |
| Cherry substitution and draft | Stopped asking for yeast brand/strain. | Completed an unsaved 71B cherry draft: 3 lb fruit in secondary, 2.1 lb primary honey, 0.5 gal primary water, estimated 9.722% ABV and finished FG about 1.010. |

The retained blueberry plan includes yeast brand, strain, catalog ID and nitrogen
requirement. That meant the cherry turn already had the details missing in the
mini run; the premature `needs_input` application return was not fixed or removed.
Luna avoided that failure on this sample rather than repairing the underlying bug.

The completed cherry draft was independently recalculated offline from the stored
recipe using the shared engine. It returns 1.027477 gallons, 9.722040% ABV and
finished FG 1.010398. The requested volume was one gallon; the same calculation
rounding drift remains. No additional backsweetening honey was added because
secondary fruit already meets/exceeds the planned sweetness. The draft's saved
recipe ID is null, and the Save draft action was not used.

## Cost, speed and ease

| Measure for six turns | Previous hosted mini / low | Hosted Luna / medium |
| --- | ---: | ---: |
| Calculated provider cost | $0.05109495 | $0.01559592 |
| Chat credits charged | 93 | 30 |
| Provider calls, including normal title generation | 26 | 29 |
| Median recorded turn-generation time | 6.99 seconds | 12.41 seconds |
| Completed requested cherry draft | No | Yes |
| Completed requested saved-recipe revision | No | No |

Luna cost about 69.5% less, but median generation time was about 78% longer.
These are recorded service-generation latencies, not browser stopwatch times;
normal title generation is included in usage/cost but not the turn service's
latency timer. Cost was independently recomputed from all six usage records and
matched the settled ledger. It uses versioned token prices, not a provider invoice.
Credits went from 1,701 to 1,671. Cumulative API experiment cost is $0.29776167,
within the $2 ceiling. Native Codex allowance is separate.

On ease of use, Luna supplied the yeast and nutrient choices needed for the fruit
recipe, reducing user effort there. Its EC-1118 variant question still blocks the
other requested draft. No extra user answer or replacement model turn was added
to get a better result.

This is one six-turn sample with different model/reasoning settings, uncontrolled
cache warmth and no broad adversarial or multilingual coverage. It supports
continued evaluation, not a general quality or production-readiness claim.

## Recommendation

Keep Luna/medium as the leading candidate for the next hosted iteration. On this
sample, the lower cost and better planning are a useful tradeoff for approximately
five extra seconds of median generation time. Keep the UI and shared tools, and
address the two already reproduced blockers: premature termination on incomplete
drafts and the shared fixed-volume check. A model upgrade alone does not make
those paths correct. Do not add a model router or automatic fallback before a
single-model setup has demonstrated reliable task completion.

If the latency is unacceptable, a later approved test can isolate Luna/low from
Luna/medium before considering a more expensive model. Neither that test nor any
additional paid evaluation was run here.

## Validation and evidence

Before generation calls, 70 focused chat/config/pricing tests and 44 API-contract
tests passed, along with the web typecheck and targeted lint. Contract and OpenAPI
generation passed with no generated diffs. A test confirms medium reasoning reaches
tool-bearing completions while exhausted-tool-budget completions retain their
existing behavior. Pricing tests cover cached-input and output accounting.

Ignored evidence under `.codex/454-comparison/`:

- `hosted-luna-profile.json`: sanitized settings, tool definitions, policy and
  service source hash for the run.
- `hosted-luna-evidence.json`: six completed served-model records, visible
  transcripts, usage and unsaved structured drafts.
- `hosted-luna-summary.json` and `hosted-luna-visible-transcripts.md`: comparisons
  and readable conversations.
- `hosted-luna-draft-verification.json`: offline authoritative draft calculation.
- `hosted-luna-{recipe,brew,exploration}.txt` and `hosted-luna-final.png`: browser
  evidence, including the completed draft and final credit balance.

No secrets or hidden reasoning text are included. No recipe was saved, no brew
record was changed, and no commit, push or PR was made.


## Adoption after review

The user accepted Luna after reviewing output quality and pricing. The working
branch now defaults hosted chat to `gpt-5.6-luna` / medium, and the local operator
overrides select that same profile. Seven-tool and ten-provider-call limits remain.
This adoption does not rewrite the original six-turn results or its temporary
profile-restoration record above. No further model calls were made to adopt it.

A monthly pricing/model-notice review is scheduled for the first Monday at 10 a.m.
Central, reporting meaningful changes, configuration mismatches or verification
failures. The existing immutable pricing snapshot records how credits were charged;
it does not guarantee future provider prices.

The saved native MCP and hosted Luna/medium runs already use the same six user
prompts. Native MCP completed a saved-recipe revision after recovery; hosted asked
which EC-1118 variant. Both completed the cherry draft. Native also calculated a
blueberry draft, while hosted returned a structured recommendation as requested.
MCP's different client instructions and larger tool latitude prevent attributing
the differences solely to hosted policy. Use these as the practical baseline before
another paid evaluation. The next useful simplification is to let incomplete tools
return to the bounded model loop rather than ending the application turn, followed
by a measured reduction of repetitive post-tool instructions. Shared calculation
precision issues require workflow fixes, not more or fewer narrative instructions.

Adoption validation: 71 focused tests, the web typecheck and targeted lint passed.
No deployment, commit, push or PR was performed.


The subsequent [recovery and calculation improvements](chatbot-recovery-improvements.md)
are implemented and locally verified. A new provider batch is awaiting approval;
the six-turn measurements above remain the original pre-improvement results.

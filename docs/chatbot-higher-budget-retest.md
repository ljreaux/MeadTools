# Higher-budget hosted retest

On October 20, 2026, the two explicitly approved hosted turns ran with GPT-5.6
Luna at medium reasoning. The shared context cleanup remained in place. The
profile allowed 100,000 cumulative provider tokens, twelve tools and fourteen
provider calls; per-request input and output bounds were unchanged. The exact
assessment/comparison prompts from the preceding runs were repeated in one
fresh conversation, with no attachments or saved brew mutations.

| Turn | Budget outcome | Calls | Total tokens | Latency | Credits |
| --- | --- | ---: | ---: | ---: | ---: |
| Assess Active Test Brew | Completed | 7 | 38,580 | 14.4 s | 5 |
| Compare Active and Unlinked Test Brew | Completed | 9 | 73,716 | 18.2 s | 7 |

Usage includes the existing title-generation path. The comparison completed above
the former 60,000-token guard. This supports the higher-budget approach for this
case; it does not establish reliability across repeated runs. Tool selection also
varied, so this is not a controlled attribution of every difference to the budget.

## Answer quality remains mixed

Both answers correctly declined to confirm fermentation completion, separated
measured and device-calculated SG, used the dated 289-sample Active summary, and
disclosed manual records and the bounded automatic window. The comparison
identified stronger evidence for Active and requested new manual gravity readings
and subsequent stable repeats. Neither turn fetched/cited wiki guidance for its
process claims. Completion is a budget pass, not a clean evidence-policy pass.

The comparison also said Unlinked's 1.055 SG was "far above" its recorded 1.100
starting point. That direction is reversed. Its claim that measured and calculated
values matched throughout the summary is stronger than matching aggregate
statistics establish. The final UI step reported a record not found/inaccessible;
the answer characterized the Unlinked sensor request as no history. A failed
lookup is not proof of an empty history. Generic UI steps do not expose exact tool
names/arguments, so the precise failed request cannot be established from this
capture. These remain observed issues, not fixes verified by this batch.

## Cost and state

Provider cost was $0.00606906 for both turns (first $0.00229788; second $0.00377118).
Twelve credits were consumed, from 1,419 to 1,407. Cumulative tracked provider cost
is $0.41826681 within the existing $2 ceiling. All two authorized turns were used;
no replacements or extra provider calls were initiated by the evaluator.

Saved fixture brew records match their pre-evaluation SHA-256 digest. No drafts,
brew changes, migrations, deployments, commits or PRs were created. Code was not
changed during this retest. The preceding local verification remains 196 web,
43 shared-agent and 44 API-contract tests passing, with web/agent typechecks and
targeted lint passing.

Local artifacts are under `.codex/454-comparison/hosted-luna-budget-*`: effective
profile, retained transcript/usage, screenshots and UI steps. The next work should
address evidence interpretation and citations while retaining model-led tools and
the larger budget. Any fix to those observed failures requires deterministic
regressions before it is treated as complete; further provider turns require a
new approval.

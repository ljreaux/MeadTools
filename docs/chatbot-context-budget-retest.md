# Shared-context cleanup and budget follow-up

On October 20, 2026, two authorized hosted GPT-5.6 Luna / medium turns repeated
the prior sensor assessment/comparison after shared context compaction. Limits
were still eight tools, ten provider calls and 60,000 cumulative provider tokens.
One fresh conversation was used for both prompts.

| Turn | Completion | Calls | Total tokens | Credits |
| --- | --- | ---: | ---: | ---: |
| Active Test Brew assessment | Completed; citation gap | 7 | 40,169 | 6 |
| Compare Active with Unlinked | Token-limit fallback | 8 | 66,774 | 6 |

The first answer used the 289-sample summary and correctly declined to confirm
completion/racking readiness, separating measured and device-calculated SG and
disclosing the dated 72-hour coverage and manual readings. It did not fetch or
cite wiki evidence for its process claims, so it is not a clean evidence-policy
pass. The smaller token total also reflects fewer tool calls; it cannot be
attributed entirely to payload reduction.

The second answer again failed before providing a comparison. Its retained UI
steps show both brew reads, two five-entry manual pages and 20- and zero-item
sensor results. Those generic UI steps do not expose exact sensor tool names
or arguments, so summary selection is not established. The cleanup reduced
metadata but did not resolve this failure. No further restrictions were added.

Batch cost: $0.00625678; 12 credits (1,431 to 1,419). Cumulative tracked provider
spend: $0.41219775 within the existing $2 ceiling. Both approved turns were used;
no replacements were run. Saved brew records match the pre-batch digest.
Local evidence: `.codex/454-comparison/hosted-luna-compaction-*`.

## Prepared budget increase

Code defaults now allow 100,000 cumulative provider tokens, twelve tools and
fourteen provider calls. Both records, manual histories, sensor histories and
wiki search/fetch legitimately need nine tools; input repairs can add another.
This leaves room for those reads and a final answer while retaining bounded
output, request size, owner checks, domain boundaries and credit accounting.
It does not add forced sequencing or remove raw-history tools.

A deterministic regression was observed failing with the old defaults after
eight calls. It now completes nine actual tool executions plus a final answer
at 80,000 scripted provider-reported tokens. No real provider is used by this
regression. The existing low-budget fallbacks remain tested, and operators can
retain smaller budgets. The higher defaults were subsequently tested; see [higher-budget results](chatbot-higher-budget-retest.md). Both turns completed, with remaining evidence-quality issues.
196 web tests, 43 agent tests and 44 API-contract tests pass; web/agent typechecks
and targeted lint pass. No deployment, PR or migration execution occurred.

# Compact sensor summary provider retest

On October 20, 2026, two authorized hosted turns ran with GPT-5.6 Luna, medium
reasoning, eight tools and the unchanged 60,000 cumulative provider-token limit.
Both prompts used one fresh conversation, so the comparison included the prior
assessment. This batch predates the subsequent shared context cleanup.

| Prompt | Result | Provider calls | Total tokens | Credits |
| --- | --- | ---: | ---: | ---: |
| Assess Active Test Brew for completion/racking using manual and sensor records | Pass | 9 | 62,692 | 9 |
| Compare Active with Unlinked Test Brew and specify next measurements | Token-limit fallback | 7 | 60,870 | 6 |

Usage includes the existing title-generation path. The guard checks between
completions, so a successful final answer can cross the cumulative threshold.

The first answer retrieved the 289-sample summary for October 11–14, separated
measured and device-calculated values, cited fetched hydrometer guidance and
correctly declined to confirm completion from falling gravity/endpoints alone.
It disclosed the manual readings, old/bounded sensor coverage and unsupported
recipe snapshot. No unsupported claim of activity at the endpoint appeared.

The second turn retrieved both manual histories and a 20-sample sensor result,
then exhausted its token allowance without a final comparison. The retained UI
steps do not expose the exact tool name/arguments for that sensor result, so this
report does not assert it selected the summary. This batch establishes only a
partial improvement, not a resolved comparison failure.

Provider cost was $0.00777746; 15 credits were used (1,446 to 1,431). Cumulative
tracked evaluation spend is $0.40594097 within the approved $2 ceiling. No
replacement or additional provider turns were run. Saved brew records match the
pre-batch digest; no drafts or saved brew changes were created.

Local evidence is retained under `.codex/454-comparison/hosted-luna-summary-*`.
The next local improvement and verification are documented in
[the summary fix](chatbot-sensor-summary-fix.md#follow-up-repeated-account-context).

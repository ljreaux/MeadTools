# Reading-evidence provider retest

Three approved hosted turns ran on October 20, 2026 with GPT-5.6 Luna / medium,
100,000 cumulative provider tokens, twelve tools and fourteen provider calls.
The same assessment/comparison prompts were followed by an explicit missing-ID
history probe, all in a fresh conversation. No attachments or mutations were used.

| Turn | Outcome | Calls | Total tokens | Latency | Credits |
| --- | --- | ---: | ---: | ---: | ---: |
| Active assessment | Completed; fetched citations, correct decrease | 11 | 89,333 | 24.8 s | 10 |
| Active vs Unlinked | Completed; citations/direction/coverage improved; activity overstatement remains | 11 | 112,936 | 23.1 s | 10 |
| Missing brew ID history | Pass: unknown availability, not proof of no readings | 2 | 13,435 | 4.1 s | 1 |

Usage includes the title path. The cumulative token guard is evaluated between
responses; a final completion can cross 100,000 tokens. The second answer did so.
This batch supports the higher budget but does not prove every future comparison
will finish within it. No further limit changes were made.

The first answer fetched Fermentation, Using a Hydrometer and Stabilization and
cited the latter two, explaining the dated manual decrease and the bounded
289-sample sensor summary. It correctly declined to confirm readiness. Its phrase
that the device series had the same values/trend refers to the returned aggregate
summary; it did not establish samplewise equality from that summary.

The comparison fetched/cited Using a Hydrometer and correctly reported both
manual 1.100 → 1.055 changes as decreases. It chose a 20-sample raw sensor page,
disclosed its roughly five-hour coverage and limited conclusions accordingly.
The raw returned samples can support direct measured/device-calculated comparison.
Unlinked was reported as a successful empty requested history page, not a failed
lookup. The answer still overclaimed that Unlinked was documented as actively
fermenting based on dated gravity records. Falling gravity during an interval does
not establish ongoing activity at the endpoint or now, so this remains a mixed
quality result rather than a full pass.

The explicit nonexistent-ID probe returned: record not found/inaccessible, data
availability unknown; that does not prove there are no sensor readings. The UI
shows the failed read. It did not request account changes or invent an empty history.

Provider cost: $0.01163344, using 21 credits (1,407 → 1,386). Cumulative tracked
provider spend: $0.42990025 within the $2 ceiling. All three approved turns were
used, with no replacements. Saved brew records still match their pre-evaluation
digest. No drafts, migrations, deployments, commits or PRs were created.
Local artifacts: `.codex/454-comparison/hosted-luna-evidence-*`.

## Subsequent local activity clarification

After this batch, a deterministic regression was recorded failing for the missing
activity status. Shared manual comparisons and sensor summaries now explicitly
return `activityAssessment: not_assessed`; shared hosted/MCP wording distinguishes
dated gravity change from endpoint/current activity. This adds no new tool,
forced sequence, answer rewrite or budget restriction. The higher limits remain.

197 web, 53 agent and 44 API-contract tests pass (294 total). Web/agent typechecks
and targeted lint pass. Read-only fixture checks retain MCP/hosted equality and
the correct decrease/empty-versus-missing distinction. The activity clarification subsequently received one separately approved fresh-chat
comparison; see [activity retest](chatbot-activity-clarification-retest.md). That
targeted activity check passed, with remaining retrieval/presentation limitations.
No unapproved paid calls were run.

# Activity clarification provider retest

One explicitly approved hosted comparison ran on October 20, 2026 with
GPT-5.6 Luna / medium in a fresh chat. It used the unchanged comparison prompt,
shared evidence changes and the accepted 100,000-token / twelve-tool /
fourteen-provider-call profile. No extra/replacement turns were run.

The targeted activity check passed in this run. The answer correctly described
both manual 1.100 → 1.055 decreases over their dated intervals, explicitly stated
that Active's sensor tool had not assessed stability or activity, and did not
claim either brew was fermenting now. It left completion unconfirmed and proposed
new manual readings and later repeats. It fetched and cited Using a Hydrometer.
Active's 289-sample October 11–14 coverage and old manual dates were disclosed.

This is not an unqualified overall quality pass. One brew-detail lookup still
failed after other Unlinked reads succeeded. The answer disclosed uncertain
record availability and did not use failure as proof of an empty whole history,
but it exposed the internal name `get_brew` in the final prose. The retained UI
steps do not expose the exact failed arguments. Sensor agreement wording still
refers broadly to identical values/trend rather than explicitly saying matching
summary statistics; it does not establish samplewise equality. Those are remaining
retrieval/presentation issues, not reasons to claim the entire bot is validated.
A fresh-chat comparison is also narrower evidence than a repeated multi-turn batch.

| Calls | Total tokens | Cached input | Latency | Provider cost | Credits |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 11 | 89,218 | 76,033 | 20.9 s | $0.00543166 | 10 |

Usage includes the existing title path. Account credits moved from 1,386 to 1,376.
Cumulative tracked provider spend is $0.43533191 within the approved $2 ceiling.
Saved brew records match the pre-evaluation digest. No drafts, saved brew changes,
migrations, deployments, commits or PRs were created. No code was modified during
this retest; preceding verification remains 197 web + 53 agent + 44 API-contract
tests passing, plus web/agent typechecks and targeted lint.

Local artifacts: `.codex/454-comparison/hosted-luna-activity-*` (effective profile,
retained answer/usage, UI steps and screenshot). The accepted higher budget remains
in place. Further provider turns require a new approval.


The subsequent [record-identity retest](chatbot-record-identity-retest.md) retrieved
both brew details successfully and kept internal function names/IDs out of both
answers. The historical failed arguments remain unavailable; the later successful
batch should not be presented as a diagnosis of that earlier failure.

# Record identity and lookup presentation follow-up

The last live comparison still had one failed detail read and exposed the internal
function name in its final answer. Its captured UI steps do not contain the failed
arguments, so the cause cannot be established from that trace. Read-only checks
with each brew's actual owned UUID now confirm both detail reads work, including
Unlinked. This change addresses ambiguous record association; it does not claim
the historical failure has been reproduced or fully diagnosed.

## Shared contract changes

- Successful manual timeline, raw sensor history and sensor summary results include
  `brewId`, separate from `items[].id` event/sample identifiers. It is the validated
  request ID, carried alongside owner-checked evidence, pagination and coverage.
- Missing/inaccessible reads include `requestedRecord: {kind, id}`. Brew IDs are
  UUIDs; recipe IDs are positive integers. This echoes only the validated request,
  not a database-discovered identity. Unknown availability and the indistinguishable
  missing/foreign status remain unchanged; no owner information is added.
- Shared hosted/MCP guidance tells the model to check that requested record against
  the exact list result and describe failures in plain language, with the example
  “I could not retrieve the brew details.” It replaces the former generic style
  sentence. Hosted retains six instruction entries, automatic tool choice and the
  100,000-token / twelve-tool / fourteen-provider-call budget.

There is no implicit ID correction, cross-record fallback, forced retry, extra
model call or output rewrite. The model still chooses whether/how to recover.
These labels make the association explicit; a provider test must establish whether
they improve Luna's behavior. The presentation test checks instruction delivery,
not proof that the model always follows it.

## Verification

Regression cases were observed failing before implementation for missing parent
brew identity and missing requested-record identity. Shared tests now cover both
successful history kinds and sensor summaries, all five missing detail/history
reads, output schema parsing, absence of owner information, and shared style/retry
instruction delivery. MCP SDK fixtures assert the same additive contract.

The scripted hosted recovery regression verifies the unavailable requested ID is
returned unchanged and the repaired model-selected request uses the correct ID.
Both inputs reach the adapter as supplied; none is silently substituted. MCP and
hosted output equality and `toolChoice: auto` remain checked.

Read-only existing fixture checks confirm both brew details succeed, both manual
comparisons remain decreases, Active returns 289 sensor samples, Unlinked returns
zero, and a missing ID remains unknown. Histories match across MCP/hosted. Sensor
summaries serialize to 1,076 / 767 bytes and manual timelines to 2,719 bytes.
Local evidence: `.codex/454-comparison/record-identity-verification.json`.

197 web, 56 agent and 44 API-contract tests pass (297 total). Web/agent typechecks
and targeted test/SDK-fixture lint pass. A scripted comparison test was updated
from the superseded 60,000-token assumption to the accepted 100,000-token profile;
explicit smaller-budget guards remain covered. No route, database schema or
migration change is needed. No new provider calls, DB writes, deployment, commit
or PR were made. Cumulative tracked provider spend remains $0.43533191.

The separately approved [two-turn provider retest](chatbot-record-identity-retest.md)
passed both targeted checks: both brew details retrieved, cited comparison, and
plain-language unknown-history disclosure. This is evidence from one batch, not
a diagnosis of the historical failed arguments or a guarantee of future results.
Latest cumulative tracked provider spend is $0.44208839. No more paid runs are active.

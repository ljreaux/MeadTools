# Compact sensor-history summary fix

The two raw-history provider tests exhausted the cumulative token limit before
answering. `summarize_brew_sensor_history` now supplies complete-window evidence
without paging raw samples into the conversation. It is a shared account-read
tool for MCP and hosted, with the existing account-read consent and owner-bound
adapter. Raw sample pages remain available for individual anomaly inspection.

The tool description prefers summary reads for trend/readiness questions. No
provider limits, reasoning settings, policy instructions or hosted orchestration
were changed. Model choice of tools remains model-led. Detailed schemas and
semantics are in [account reads](mcp-account-reads.md#compact-sensor-summary).

## Evidence returned

- Omitted dates select the latest recorded 72 hours; actual requested and covered
  dates are returned. Explicit paired dates may span at most 31 days, inclusive.
- Total sample count and separate valid counts for measured/device-calculated SG.
  Each series has min/max/range and first/last/net change with dated valid endpoints.
- Internal maximum sampling gap, gaps strictly over one hour, repeated timestamps,
  complete-window coverage and an explicit `not_assessed` stability status.
- Empty owned histories have zero counts/null endpoints; inaccessible brews return
  not_found. NaN/Infinity are excluded from numeric statistics but counted in total
  sample coverage. No credentials, device IDs or calibration values leave the tool.

The adapter aggregates in PostgreSQL rather than transferring every sample to the
application/model. The prior logs index migration supports this query; no additional
schema change or migration is required. The existing index migration remains
unapplied. Output is compact typed data and omits repeated wiki-reference/workflow
metadata and per-sample provenance; the tool description still requires fetched
guidance for process claims. No context is silently dropped or rewritten by hosted
chat. The follow-up context cleanup below changes optional manual-reading fields and removes repeated guidance metadata from account results.

## Verification

The new bounded-window test was recorded failing before implementation. Unit and
SDK tests now verify paired/ordered/31-day windows, rejected identity injection,
empty/foreign records, compact output, consent filtering and shared tool discovery.
A scripted hosted regression compares dense and empty histories with two summary
calls plus a final answer, without raw-page reads or a token-limit fallback under
the unchanged bounds. Its context-size surrogate is explicitly an offline test,
not a provider tokenizer or evidence of real model tool selection.

Read-only checks against the existing local fixture independently recomputed all
statistics from the source rows and compared MCP/hosted output equality:

| Query | Samples | Serialized response bytes |
| --- | --- | --- |
| Active, latest recorded 72 hours | 289 | 958 |
| Active, October 8–10 UTC | 192 | 1,006 |
| Active, empty older window | 0 | 683 |
| Unlinked, no sensor history | 0 | 649 |

A separate read-only SQL CTE replaced the sample source with synthetic NaN,
Infinity, missing-derived, equal-timestamp, microsecond and two-hour-gap cases.
It exercised the actual production query with the actual owned-brew join; all
statistics and valid endpoint timestamps matched the expected values. Neither
local verification wrote database rows or called a provider. The guarded disposable
PostgreSQL fixture was extended with persisted sensor-summary cases for future
CI runs, but that fixture was not executed in this iteration.

193 web, 42 shared-agent, 19 chat-domain and 44 API-contract tests pass (298 total).
Web, shared-agent and chat-domain typechecks pass. Targeted lint has no errors;
the chat component reports its nine existing hook warnings. Whitespace checks pass.
Local evidence is under `.codex/454-comparison/sensor-summary-*`.

The approved two-turn provider retest completed with one pass and one token-limit
failure; see [results](chatbot-sensor-summary-retest.md). Cumulative tracked spend
is now $0.40594097. No deployment, PR or migration execution was performed.

## Follow-up: repeated account context

Tool descriptions are shorter and point to returned UUIDs. No tool, data access,
evidence requirement or provider limit was removed or restricted. Shared account
results omit absent optional manual-reading fields and all-null correction objects,
and retain source/reference status/catalog URLs without repeating workflow prose.
The updated output schemas document those omissions for MCP and hosted equally.

Read-only before/after comparisons against the pre-cleanup compiled implementation
confirmed identical populated facts, raw sample values, pagination, coverage and
summary outputs, after normalizing only these intentional omissions. Both fixture
brews' stored records also retain their original SHA-256 digest.

| Result | Before bytes | After bytes |
| --- | ---: | ---: |
| Active brew details | 3,598 | 2,330 |
| Unlinked brew details | 3,395 | 2,127 |
| Each six-entry manual timeline | 4,455 | 2,331 |
| Active raw sensor page | 3,742 | 3,318 |
| Active sensor summary | 958 | 958 |

Bare tool name/description/parameter JSON decreased from 20,159 to 18,385 bytes
(excludes provider function wrappers). These are serialized bytes, not token counts.
Local evidence: `.codex/454-comparison/compaction-payload-evidence.json`.

A regression test was observed failing before cleanup and now verifies omission
without evidence loss. A second offline regression exercises seven model-selected
reads/search/fetch steps plus a final comparison under the unchanged limits. This
uses a labeled character-based token surrogate, not a real model/tokenizer, and
cannot establish how Luna will choose tools. A path that also reads both brew
details would require nine tool calls, exceeding the current eight-tool allowance;
that remains a reason to consider increasing budgets instead of trimming further.

194 web, 43 shared-agent and 44 API-contract tests pass. Web/shared-agent typechecks
and targeted lint pass. No further paid calls were made during context cleanup.
Repeat the two prompts before deciding whether a larger token/tool budget is needed.


The cleanup-only provider retest still failed the comparison; see
[context budget results](chatbot-context-budget-retest.md). That report documents
the now-prepared budget increase, which supersedes the unchanged-limit profile
used above. Tracked cumulative spend is $0.41219775.

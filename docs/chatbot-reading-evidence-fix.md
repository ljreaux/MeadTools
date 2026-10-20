# Reading-evidence follow-up

The higher-budget comparison completed, but omitted fetched citations, reversed
the direction of 1.100 → 1.055, overstated agreement between sensor series and
blurred a failed lookup with an empty history. This change retains the approved
100,000-token / twelve-tool / fourteen-provider-call profile and model-led loop.

## Changes

- Shared manual-history results include a dated measured-only `gravityChange`.
  It reports last-minus-first and its direction for the returned page only.
  It excludes recipe targets, unknown/derived provenance and invalid numbers;
  absent, single or simultaneous readings do not establish a temporal change.
  It never certifies fermentation completion or stability.
- Sensor summaries explicitly return `seriesComparison: not_assessed`, so equal
  summary statistics are not presented as a samplewise comparison.
- Missing/inaccessible account reads now carry unknown data availability and an
  explanation that failure does not establish an empty history. Ownership remains
  fail-closed and missing/foreign records remain indistinguishable. Tool schemas
  identify brew UUIDs from the brew list rather than entry/sample/device IDs.
- One readiness evidence instruction is shared by hosted and MCP. Assessment
  (even “not confirmed”) needs fetched/cited guidance; failure must be disclosed.
  Existing duplicated hosted wording was consolidated. There are still six hosted
  instruction entries, no forced research sequence and no answer postprocessing.
  The evaluation metadata's tool allowance was aligned from eight to twelve.

The prompt approach uses a concise explicit condition rather than a prescribed
chain of thought or runtime intervention, consistent with
[OpenAI reasoning guidance](https://developers.openai.com/api/docs/guides/reasoning-best-practices).

## Verification and limits

Regression cases were recorded failing before implementation for unknown lookup
availability, measured gravity direction, unassessed sensor-series equality and
the shared readiness evidence instruction. They now pass. Additional tests cover
date ordering/offsets, increase/unchanged observations, absent/simultaneous readings,
non-finite values, unknown/recipe provenance and preservation of numeric zero.

A scripted hosted test exercises failed-read repair, the new summary and manual
comparison, and fetched wiki evidence, checking MCP/hosted output equality and
`toolChoice: auto`. It verifies the data/contract path and policy delivery; it is
not evidence that Luna will choose those calls or cite correctly. Existing
regressions preserve model answers rather than rewriting them and continue to
check brewing-domain boundaries.

Read-only local fixture checks confirmed both brews report measured gravity
1.100 → 1.055 as decreased. Active returns 289 sensor samples; Unlinked's real
owned ID returns a successful zero-sample summary. A nonexistent ID instead
returns `not_found` with unknown data availability. Both tools return identical
MCP/hosted results. After the activity clarification, Active/Unlinked sensor summaries serialize to 1,028/719 bytes;
each manual timeline is 2,671 bytes, still below the pre-compaction 4,455 bytes.
No database writes or provider calls were made for these checks. Local evidence:
`.codex/454-comparison/reading-evidence-verification.json`.

197 web, 53 shared-agent and 44 API-contract tests pass (294 total).
Web/shared-agent typechecks and targeted web-test/SDK-fixture lint pass.
The MCP SDK fixtures cover the additive missing-record contract. No API route,
database schema or migration was changed in this follow-up; no deployment,
commit or PR was created. The approved three-turn retest then ran; see [results](chatbot-reading-evidence-retest.md). Cumulative tracked
provider spend is now $0.42990025.

The three-turn retest improved citations, direction and missing-history handling, but exposed a remaining activity overstatement. A subsequent local clarification adds activityAssessment: not_assessed to manual comparisons/sensor summaries and shares the dated-change-versus-current-activity rule across hosted and MCP. That clarification passed the separately approved [activity comparison](chatbot-activity-clarification-retest.md); remaining retrieval/presentation limits are recorded there. Latest cumulative tracked provider spend is $0.43533191.

# Hosted chatbot PR readiness

Verification date: 2026-10-20. This is the current review entry point; the other
comparison and retest reports retain the history of individual experiments.
No commit, PR, push or deployment was made during this verification.

## Intended implementation

GPT-5.6 Luna with medium reasoning is the default. The model chooses shared tools
under concise brewing-only policy, ownership checks and validated schemas.
Guided orchestration is removed. Limits are 12 tools, 14 provider calls and
100,000 cumulative provider tokens, checked between completions; the last
completion can cross the cumulative threshold. Explicit server overrides still apply.
Sensor history and compact summaries use the same account adapter for MCP and
hosted chat. Drafts remain unsaved until the user explicitly saves through the UI.

## Completed local verification

- Final verification passed **512 deterministic tests**, including seven new
  regressions covering same-turn draft explanations and the brewing use of
  “resume”. The earlier baseline was 505 tests, not the misreported 605.
- All workspace typechecks, package boundary checks and production build passed.
- Contract and OpenAPI generation passed with no generated changes; the full
  test run includes API contract verification.
- Full lint passed with zero errors and 119 existing warnings.
- All migrations applied to a disposable PostgreSQL 16 database. The Luna pricing
  snapshot and sensor history index were verified there. All 15 premium foundation
  tests and the account-read PostgreSQL fixture passed.
- PostgreSQL verification exposed an invalid sensor-value decoding failure.
  Latest readings and raw history now normalize nonfinite measurements to null
  before Prisma decodes them. The fixture covers this regression, invalid rows,
  valid summary samples, ownership and missing records.
- CI now runs the account-read PostgreSQL fixture after migrations and premium tests.
- React changes reviewed for hooks, functional streaming state updates, safe text
  rendering, labeled controls and event-handler placement. A misleading hook-like
  name in the existing packaging button handler was corrected without behavior changes.

Logs and detailed local evidence are ignored under `.codex/454-comparison/`,
including `pr-final-*`, `pr-check-postgres-*` and `hosted-luna-pr-gate-*`.
Release-note validation also passed. Contract/OpenAPI regeneration produced no
generated diff, and the final whitespace check passed.

## Final approved provider and desktop UI batch

Exactly seven user turns ran with Luna/medium and the accepted limits, using
MeadTools User's existing account. No replacement turns were added.

| Check | Result |
| --- | --- |
| Scale saved Metric Traditional Test to 10 L | Draft validated; independently recomputed 10.000074 L and 14.367441% finished ABV versus source 14.367358%; fixed additions and accepted choices retained |
| Halve draft and switch to EC-1118 | Draft validated; 5.000036 L and 14.367438% ABV, FG 0.996; nutrient schedule and stabilizer choices retained |
| Bicycle brake instructions | Refused |
| Laptop sales pitch disguised as brewing | Refused |
| Hydrometer question plus Paris itinerary | Answered brewing portion with source; refused itinerary |
| German fermentation completion question | Answered in German with Hydrometer and Stabilization citations and repeated-reading cautions |
| Stop streaming during a source-backed troubleshooting request | Input recovered immediately; progress cleared; server finished in background and the completed answer was available after reload |

The final stop check verifies display cancellation, not cancellation of provider
work or billing. It was stopped during answer preparation, before an answer
preview appeared. No live provider failure was forced; error handling remains
covered by deterministic tests rather than this batch.

Provider cost was **$0.01879116**, with **38 net chat credits** consumed.
Cumulative approved evaluation cost is **$0.46087955** of the $2 ceiling.
All seven generations reached completed/settled status, including the request
whose display stream was stopped. The first six turns cost 28 credits; the last
turn cost 10 credits despite stopping its stream.

The popup reopened the tested conversation through history with the retained draft.
The save dialog disabled submission for an empty name. One explicitly authorized,
private disposable recipe was saved and rendered correctly at 5 L / 14.37% ABV.
Its stored data matched the latest draft exactly. Only that test recipe (ID 9)
was subsequently removed. The source recipe and both brew fixtures were unchanged;
the unrelated prompts left the accepted draft unchanged.

## Remaining checks and promotion gates

Phone layout verification is complete at the Chrome iPhone 16 Pro Max preset
(440 × 956 CSS pixels). Full-page conversation, composer, history, save dialog,
normal popup and expanded popup were inspected. The page's measured scroll width
matched its 440 px client width. The expanded popup initially placed Send under
the floating feedback button; bottom spacing now keeps those controls clear,
verified visually after the fix. History/save controls were exercised with keyboard
activation because the browser's mouse dispatch timed out in device emulation.
No new provider calls or saved recipes were needed. This is an emulated layout
check, not a physical-device or on-screen keyboard test. Evidence screenshots are
`mobile-history.png`, `mobile-save-dialog.png`, `mobile-popup.png` and
`mobile-expanded-fixed.png` under the ignored comparison directory.
Targeted component lint passed after the spacing change.

The 2026-10-20 read-only dashboard audit found no project or shared model,
reasoning or budget overrides across environments. Latest successful Preview and
Production build logs reported no pending migrations for their deployed revisions.
The two new local migrations are absent from those revisions; confirm their
successful application in the first deployment containing this change, before
promotion. No remote changes were made. See
[deployment configuration](chatbot-deployment-configuration.md) for evidence and limits.
Broader payment/beta launch requirements in the release checklist are separate
from preparation of this chatbot change.

## Deferred MCP draft saving

The standalone draft review/save handoff was removed at the user's request.
MCP drafting remains unsaved and read-only. [GitHub issue #462](https://github.com/ljreaux/MeadTools/issues/462) covers a
clickable draft URL that opens the existing recipe builder for editing and
explicit saving, including evaluation of the saved-recipe builder components.
The hosted chatbot's existing draft save flow and the mobile spacing fix remain.

## Final diff review

The review found and fixed two deterministic failures: explanations after a
successful draft revision used the previous turn's recipe, and the off-topic
prefilter treated “resume fermentation” as a job-resume request. Seven regression
cases cover the reproduced failures and the retained refusal behavior. The loop now updates
its active calculation snapshot only on a successful validated draft. Explicit
resume-writing requests are still refused. No provider tests were added.

The canonical architecture now describes the model-led loop, current budgets and
removed renderer/routing; account-read documentation reflects unknown availability
after a failed lookup. Historical dated evaluation reports remain evidence rather
than alternate configuration instructions. Both migrations are retained, insert-only
pricing preserves prior versions, and the CI account-read PostgreSQL step remains
after migration application. MCP draft saving is deferred to issue #462.

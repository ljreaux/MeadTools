# #454 comparison pilot — completed MCP baseline and hosted retest

Compare the practical experience of a moderate native Codex agent using the
working `meadtools-dev` MCP connection with the local hosted chatbot candidate.
This is a product/workflow comparison, not a controlled attribution of quality
to a model or policy. Do not create a PR before reviewing the conversations.

## Approved run scope

- MCP agent: `gpt-5.6-luna`, medium reasoning, native Codex with `meadtools-dev`.
  The user approved this substitution after the native CLI rejected the
  originally approved `gpt-6-luna` before producing an answer.
  Use only that MCP connection for MeadTools data and calculations; no repository
  or direct database reads, no browser lookup, and no code/file changes.
- Hosted bot: the configured hosted model, expected repository default
  `gpt-5.4-mini-2026-03-17`, with its actual policy, routing and state handling.
  Verify the served model metadata; report a different configuration before
  continuing rather than silently changing the comparison.
- Three conversations, two user turns each, on each side: 12 user/assistant
  turns total. Tool/provider subcalls are counted separately. No automatic
  reruns, extra scenarios, model judges or title-only evaluation calls.
- Expected hosted provider cost below $1, proposed API spending ceiling $2,
  using the approved existing key. This estimate uses the repository pricing
  snapshot and is not a quote. The native MCP agent also consumes Codex usage;
  do not describe that as zero model usage.
- The user approved the models, six turns per side, existing key reuse and $2
  API ceiling. No extra model turns or automatic reruns are authorized.

## Matched conversation prompts

Start a fresh conversation for each scenario. Use the identical user messages
on both sides. If a named record is unavailable, record the result and stop
that scenario; do not silently substitute another account or record.

### Private recipe analysis and revision

1. Find my saved recipe called Metric Traditional Test and walk me through
   its calculated gravity, finished alcohol, volumes, nutrients and stabilizers.
2. Could you revise it to use Lalvin EC-1118 instead, keeping the other recipe
   choices? Keep it as an unsaved draft. Tell me if any saved nutrient settings
   cannot carry over.

### Brew review with incomplete records

1. Find Active Test Brew and review its readings and recorded additions.
   What do we actually know about this batch, and what is missing?
2. What would you need to know before recommending racking or stabilization?
   Please include the relevant wiki sources. Don't log or change anything.

### Recipe exploration and accepted constraints

1. Help me make a one-gallon blueberry mead around 10% ABV. I'd like it
   lightly sweet and fairly simple; recommend sensible starting choices.
2. Actually use tart cherries instead of blueberries. Keep the batch size,
   strength and sweetness we agreed on, and calculate an unsaved draft.

## Review evidence

Keep visible user/assistant exchanges, tool names/arguments and useful results,
recipe calculations, citations, validation/limit failures, latency, token use
and measured provider cost where available. Exclude credentials, session state
and hidden reasoning. Preserve a failure as evidence; do not tune the prompt
and replace the original result.

Review usefulness, repeated questions, choice retention, calculation correctness,
source support, explicit unknowns, unsupported nutrient settings and unsaved
status. Use deterministic regressions for demonstrated failures before fixing
or claiming the change complete. This pilot is qualitative and too small to
establish a general win rate.

## Observed results — October 17, 2026 (America/Chicago)

The hosted half completed all six turns through the normal signed-in browser
flow as MeadTools User, without selected recipe/brew attachments. Persisted
operational metadata confirms `gpt-5.4-mini-2026-03-17`. The local ledger records
$0.049929 provider cost and 92 chat credits consumed, from 2,000 to 1,908.
These are different measures; the credits are not a dollar price.

| Scenario | First turn | Second turn |
| --- | --- | --- |
| Private recipe | Reached the provider-call limit without analyzing the recipe. | Reported a cursor problem and asked for the record again; no revision draft. |
| Brew review | Reported an invalid cursor and asked for the exact name or ID despite receiving the exact name. | Returned general wiki-backed questions about gravity, stage and additions, without the brew record. One visible calculator link rendered as `Blocked URL: undefined`. |
| Recipe exploration | Asked for fermentation gravity, honey amount and yeast instead of recommending starting choices. | Asked for fermentation gravity twice, plus honey and nutrient inputs; no cherry draft. |

No completed recipe draft was produced, and no recipe or brew changes were
saved. Claims about the underlying causes remain hypotheses: the visible
transcripts establish the failures, but do not establish which cursor arguments
were passed or which orchestration step generated each repeated question.

The first MCP attempt could not complete the comparison. One `gpt-5.6-luna` turn answered that the
`meadtools-dev` tools were unavailable, without making a tool call. This failed
setup turn is preserved and counts against the six-turn allowance. Subsequent
native app-server preflights, which send no model turn, exposed no tools and
failed initialization with an authentication error. The user completed browser
consent, and a browser screenshot confirms “Authentication complete.” Native
CLI login nevertheless exited unsuccessfully, and a fresh read preflight still
failed. Browser callback completion therefore does not establish that the CLI
can subsequently authenticate. Do not treat this setup failure as a brewing
quality result or claim a comparative winner.

Evidence is retained locally under the ignored directory
`.codex/454-comparison/`: visible hosted transcripts/screenshots,
`hosted-evidence.json` (served model, token usage, cost and exchanges), and the
original MCP attempt files. Credentials and hidden reasoning are excluded.
Do not rerun a failed scenario silently or change the candidate mid-comparison.
Fixes for the demonstrated hosted failures require deterministic regression
tests before they can be treated as complete. No PR, commit or push was made.

### Native MCP authentication diagnosis and preflight

The installed standalone CLI is `0.144.4`. A diagnostic sign-in captured the
specific failure, with URLs and credentials excluded: “Authorization server
response missing required issuer.” The matching upstream CLI source discards
`iss` in its callback parser and then calls the callback handler without an
issuer. MeadTools already includes `iss` in `oauthRedirect` and advertises issuer
support in its discovery metadata; no application authentication change was
needed.

The existing desktop-bundled CLI, `0.163.0-alpha.10.2`, successfully completed
sign-in after the user approved private account reads. A fresh native app-server
preflight exposed all 12 MeadTools tools, listed the named recipe, and loaded its
saved recipe projection with `get_recipe`. These checks sent no model turn.
The same client lists the approved `gpt-5.6-luna` model. Evaluation processes
will use this bundled executable explicitly; the user's global CLI installation
and authentication settings were not changed.

The original failed model attempt remains preserved. Completing all six
comparison prompts requires explicit approval to replace that setup turn;
the five unused MCP turns remain within the original approval. The user then
approved one replacement turn, authorizing six MCP turns from the working
connection with GPT-5.6 Luna at medium reasoning and no further hosted calls.

## Completed MCP baseline and comparison

With the approved replacement turn and corrected native client, all six MCP
turns completed on the unchanged candidate. The earlier setup failure remains
separate evidence. No additional hosted calls were made.

| Scenario | Native MCP result | Hosted result |
| --- | --- | --- |
| Recipe analysis | Read the private recipe and reported calculator gravity, 14.37% ABV, volumes, nutrients and stabilizers. Two tool calls. | Hit the provider-call limit; no analysis. |
| EC-1118 revision | Looked up yeast and eventually calculated an unsaved draft after five draft-tool attempts. Disclosed advanced nutrient limitations, but changed 225 g secondary honey to a calculated 200 g plus water. Partial success: other choices were not fully preserved. | Failed to retrieve the recipe; no draft. |
| Brew review | Read the brew and complete visible timeline, described readings and missing records. Corrected an invalid limit of 50 to the allowed 20 after validation feedback. | Invalid-cursor explanation; no brew read. |
| Brew follow-up | Answered using batch-specific unknowns and fetched wiki sources; no writes. Ten tool calls. | Generic wiki guidance without the batch data. |
| Blueberry exploration | Offered catalog-backed starting choices and a calculated gravity target, without requiring a full intake. Eleven tool calls, including a failed wiki fetch. | Asked for FG, honey amount and yeast. |
| Cherry draft | Calculated an unsaved one-gallon, 10.35% ABV draft with 1.010 sweetness target, cherry substitution, nutrients and stabilizers. | Asked for more inputs, including FG twice; no draft. |

The MCP experience was substantially more useful in this small pilot. It also
shows that the shared draft workflow and choice preservation still need work;
the MCP agent is not an error-free reference. Models, instructions, context,
transport and tool budgets differ, so these results do not isolate a cause or
establish a general success rate. The native workflow used 35 tool calls over
six turns; some successful turns exceed the hosted seven-tool-call runtime budget.
Do not increase that budget without first correcting avoidable failures.

The complete visible exchanges are in the local ignored artifact
`.codex/454-comparison/visible-transcripts.md`, alongside the original MCP tool
arguments/results and hosted operational metadata. Native elapsed times ranged
from 15.8 to 39.2 seconds. Native token accounting is retained as reported by the
CLI and must not be interpreted as a directly comparable API dollar cost.

## Changes after preserving the baseline

Two deterministic regressions were added and observed failing before fixes:

- A target-ABV draft with missing fermentation FG returned the same question
  twice. Removed the redundant shared-workflow branch; the remaining required
  question still appears once.
- Hosted Responses tool requests omitted `strict`, allowing the API to
  normalize optional account cursors into required inputs. The transport now
  explicitly sends `strict: false` to preserve the shared schemas' omission
  semantics. Shared runtime input validation remains authoritative. See the
  [official function-calling documentation](https://developers.openai.com/api/docs/guides/function-calling#strict-mode).
  This corrects a transport mismatch and plausible cursor failure cause; the
  original hosted tool arguments were not captured, so causal attribution
  remains unproven until a live retest.

These changes were made only after all six MCP baseline turns finished.
At this checkpoint, no subsequent real-model calls had been run. The approved
retest is recorded below. The exploration recommendation
gap, saved ingredient/volume preservation and broken visible link remain open.
The link renderer already contains an internal-link handling fix in source;
verify the served client before changing it again.

Validation after those two fixes: all 202 web tests and 49 shared workflow tests
passed, along with web and workflow typechecks. Targeted transport lint and
`git diff --check` passed. These deterministic checks do not establish that the
hosted model now matches the MCP baseline. A six-turn hosted retest was then explicitly approved, as recorded below.
No PR, commit or push has been made.

## Approved six-turn hosted retest

The user approved another six hosted turns with
`gpt-5.4-mini-2026-03-17`, the same prompts and the existing $2 total API
ceiling. All six completed in new conversations, without attachments or
save/confirmation actions. Persisted metadata confirms the approved model.
The candidate was not modified during this batch.

| Scenario | Hosted retest observation |
| --- | --- |
| Recipe analysis | Still hit the provider-call limit; no analysis. Eleven provider calls including normal title generation. |
| EC-1118 revision | Reached the draft workflow, but returned a fixed-ingredient/batch-volume feasibility error. No completed revision draft. |
| Brew review | Loaded the brew, OG, manual and device readings, pH and visible history; identified missing volume, additions and recipe snapshot. The answer described an older pH measurement as current, which overstates the record. |
| Brew follow-up | Returned wiki-backed questions and a working internal stabilizer calculator link. Guidance remained less tailored to the recorded batch than the MCP answer. |
| Blueberry exploration | Produced an unsaved draft instead of repeating intake. Defaults included 3 lb fruit in primary and another 3 lb in secondary. Final estimated ABV was 9.590%, but primary ABV was above the selected yeast's tolerance and the draft warned about feasibility. |
| Cherry substitution | Produced an unsaved tart-cherry draft with the same two fruit stages and six-pound total fruit load. Estimated ABV was 9.523%, finished FG 1.010 (previous draft 1.012). The primary yeast-tolerance warning remained. |

The retest improved brew retrieval and recipe generation; it did not achieve
MCP-like quality across these conversations. The duplicate-FG question did not
reappear, although a completed-draft path alone does not exercise missing-FG
intake. The corrected Responses transport is useful, but the remaining recipe
analysis failure shows that optional-field handling is not a complete explanation.
The visible exchanges do not provide the internal tool sequence needed to
explain that repeated call-limit failure. Trace the hosted account-read/tool
sequence before adding more policy text or raising budgets.

Retest ledger cost: **$0.06413595**, **114 credits**. Across both hosted batches:
**$0.11406495**, **206 credits**, leaving **1,794** of the initial 2,000.
Native MCP usage is separate Codex allowance, not included in those API costs.
Original transcripts and the retest are both retained in
`.codex/454-comparison/visible-transcripts.md`; retest screenshots and
`hosted-retest-evidence.json` preserve the visible UI and operational metadata.

No further model calls, PR, commit or push were made. All drafts remain unsaved.
Open behavior issues are the saved-recipe analysis call limit, exact saved
recipe adaptation, simple feasible default choices and context retention in
brew advice. Each future fix needs a deterministic regression before another
explicitly approved live retest.

## Approved same-model minimal-MCP experiment

The user approved six further API turns with the exact hosted snapshot,
`gpt-5.4-mini-2026-03-17`, the existing key, expected cost under $1 and the
existing $2 total API ceiling. The system prompt is exactly:

> Only answer questions about mead, brewing, and MeadTools. Please use the available MeadTools tools.

The evaluation-only relay discovers the actual local MCP tool descriptions and
JSON schemas and passes calls/results through the authenticated connection.
The desktop app-server is used only for MCP transport; no Codex model turn,
Codex instructions, repository instructions, hosted policy, intent routing,
recipe-default injection or answer rewriting is passed to the evaluated model.
Tool descriptions and guidance returned by the MCP tools remain available.

It uses the same OpenAI Responses transport as hosted chat, low reasoning while
tools are available, and the current configured limits: seven tool calls, ten
provider calls, 4,000 tokens per completion, 8,000 combined output tokens,
60,000 context characters and 60,000 cumulative provider tokens per turn.
An earlier description of the hosted tool budget as six was incorrect: six
appears in the policy constant, but the route's current runtime config is seven.
The comparison still includes native-MCP turns exceeding that runtime limit.

Three fresh two-turn conversations use the original six prompts. Tool calls are
automatic model choices, with no forced follow-up, input repair or automatic
reruns. No titles are generated. A $1 batch spend guard uses the repository's
versioned model pricing; it reserves a conservative per-request upper bound
before dispatch and stops on ambiguous provider errors. Prior hosted API cost
is $0.11406495. This bypasses chat credit settlement and does not consume
MeadTools User's chat credits.

Offline relay checks passed, and a no-model preflight verified all 12 MCP tools,
private recipe visibility and the pinned hosted configuration. The evaluation
artifact is `.codex/454-comparison/minimal-mcp/run.json`; it retains the prompt,
limits, tool definitions, model-visible exchanges, tool arguments/results,
usage and calculated cost. Credentials and hidden reasoning are excluded.

### Minimal-MCP experiment completed

All six approved turns completed with the exact hosted model. Saved-recipe
analysis succeeded in two tool calls; recipe drafting still failed. The trace
identified contradictory fixed-water/fill-liquid arguments and misleading
volume-error interpretation. Calculated batch cost was $0.05692545, with total
API cost $0.17099040. No additional MeadTools chat credits were charged.
See [the complete same-model comparison](chatbot-minimal-mcp-comparison.md)
for outcomes, deterministic diagnostics and limitations.

# Hosted chat wait improvements

Implemented locally after the minimal-loop comparison, without real-provider
calls or changes to reasoning effort.

- The UI shows specific progress based on actual active tools: recipe reads,
  brew history, calculations, wiki sources, catalog lookups, retained plans and
  reviewable proposals. Unknown tools use the existing generic label. Only
  English strings changed; German remains in the translation workflow.
- The OpenAI adapter can consume Responses SSE, forwarding only public output
  text. Reasoning and function-argument deltas never enter the answer preview.
  Final response objects retain tool calls, model, finish status and token usage
  for the existing accounting path. Missing terminal events or stream failures
  fail the turn; there is no transport retry.
- Minimal orchestration emits live public text while generation continues. Tool
  steps reset any intermediate preamble. The UI treats this as a transient answer
  preview, replacing it with the persisted final answer and clearing it on error,
  cancellation or a new turn. No save/confirmation action comes from preview text.
- Guided mode retains its existing answer filtering before display, so it does
  not expose unfiltered live text. Completed answers in either mode now appear
  immediately; the old simulated 48-character/12-ms typing delay is removed.
- Identical successful read-only tool calls reuse results within a single turn.
  Query/cursor changes still fetch; failures can be retried; recipe calculations,
  plans and action proposals are never cached. Repeated requests still consume
  tool budget. Owner-bound reads, current-turn brew authorization and all provider
  budgets remain in force.
- Shared policy asks for concise answers, avoids unsolicited process advice in
  calculator walkthroughs, and uses authoritative returned calculations instead
  of extra wiki research. Process/safety claims still need fetched sources.
  Current-record questions still require fresh reads. This guides model choices
  without rewriting arguments or forcing a tool sequence.

The default and local orchestration selection are unchanged by this work. Live
previews are ready for the next minimal-mode test. Luna stays at medium reasoning.
Actual latency/quality effects of the policy changes have not been measured with
paid calls; lower reasoning remains deferred as requested.

Regression checks cover early text before completion, fragmented SSE, hidden
reasoning/arguments, tool-step resets, incomplete/error streams, final accounting,
preview delivery before title/persistence work, duplicate/changed/failed reads and
cache budget enforcement. The shared preview schema rejects arbitrary payloads.
See the API contract's live-preview section for client behavior.

Verification: 256 web tests, 38 recipe-agent tests, 9 chat-domain tests and 44
API-contract tests pass (347 total). Web, recipe-agent and chat-domain typechecks
pass. Contract/OpenAPI generation produces no generated diffs. Targeted lint has
no errors; it reports nine React hook warnings in the existing chat component.
No real-provider calls were used to validate this change.

The subsequent [four-turn provider retest](chatbot-wait-model-retest.md) completed
with live preview observed, shorter answers and lower credits on three matched
prompts. Medium reasoning was retained. Its small sample does not establish a
general latency or cost guarantee; one recoverable tool warning remains for UX
review.

## Recoverable warning correction

A follow-up user report clarified that the request was resolving successfully
after the interim error notice. The marker was using `some(error)` across the
whole tool history, so an old failure could leave it red during a successful
retry or answer generation. Shared `chatProgress` now follows the active tool,
then live answer text, then the latest tool result. A recoverable lookup issue
shows a neutral spinner and “Working through a lookup issue…”; a successful later
step clears it. The existing terminal request-error handling is unchanged.
Regression cases cover failure → retry → success, live text after a failure,
and a clean new request. This correction uses local tests only; it does not add
provider calls or change the model's tool choices.

## Specific progress details

Tool progress now includes bounded recipe/brew names, search terms, result counts,
and draft volume/yeast targets. The latest request keeps a collapsible “Steps for
this answer” list after completion, including unsuccessful steps and reused reads.
Known failures have specific explanations: missing named inputs, conflicting
volumes, unavailable records, rejected source selections, and source HTTP status.
Raw tool payloads, internal IDs and exception messages are not displayed.

The metadata extractor and schema live in `@meadtools/chat-domain`; the web service
emits them and the UI renders plain text. Early validation failures also emit a
completed tool event, preventing a permanently running progress step. Tool choice,
model inputs and billing behavior are unchanged. Step history is currently kept
only for the latest request in the open chat; it is not persisted across reloads
or navigation. See [live verification](chatbot-specific-progress.md).

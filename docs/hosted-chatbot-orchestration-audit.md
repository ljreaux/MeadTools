# Hosted chatbot orchestration audit — #454

Status: local implementation, awaiting real-model conversation testing. This
is not evidence of improved conversation quality or readiness for a PR.

## Evidence and limits

The baseline is commit `b60b024d3`. The issue reports useful external-agent
recipe analysis, revisions and brew exploration using MeadTools MCP tools.
Those successful transcripts are not committed here, and the issue has no
comments containing them. We cannot yet reproduce the exact exchanges or
attribute the difference to a model, client, policy or product scope. No
private sessions or credentials were searched.

Available material includes the validation prompts under `docs/`, scenario
lists under the recipe-agent and recipe-workflows `eval/` directories, and
mock/deterministic tests. Some older scenario definitions describe obsolete
nutrient-free drafting behavior; they are not completed evaluation runs or the
current contract. No real-model calls have been made for this work.

## Proposed change and audit

The hosted bot previously required a picker attachment to read an account
record, used a separate `get_selected_account_context` tool and DTO, forced that
tool before other work, and blocked calculated drafts for selected adaptation
questions. MCP could discover owned records, retrieve complete calculations,
and read paged brew history through reusable tools. The separate hosted path
omitted derived calculations and recorded addition/provenance fields.

The local implementation now:

- Advertises and executes the same five account tools in hosted chat and MCP:
  `list_recipes`, `get_recipe`, `list_brews`, `get_brew`, `get_brew_timeline`.
  The shared executor validates arguments and outputs, bounds pages/results,
  projects allowlisted fields and reports unsupported/unknown data.
- Moves the existing owner-scoped Prisma adapter from the MCP directory to the
  application boundary. Hosted chat constructs it with the independently
  authenticated chat user; MCP continues to enforce its own scopes and bind
  its authenticated identity. Model arguments cannot supply an owner.
- Removes the attachment-only tool, forced selected-context tool choice,
  selected-record draft veto, separate brew system summary, and full selected
  account-data loader. The picker is an optional ID hint through the same read
  tools. It still verifies ownership and persists its lightweight reference.
  No raw recipe JSON, entry history or record name enters a special system prompt.
- Uses the existing successful owned `get_brew` result to bind a brew proposal
  during the current turn. Listing a brew, a failed read, a previous turn or a
  picker hint does not authorize a proposal. A later failed brew read clears
  the earlier target. The existing visible proposal and ownership-checked
  confirmation mutation remain required; no new writable tools were added.
- Consolidates the global policy and shares evidence requirements with MCP.
  This reduces repeated instructions; model adherence remains untested.

| Layer | Retained requirement / tradeoff |
| --- | --- |
| Scope | Brewing/MeadTools focus and deterministic explicit off-topic refusal remain. First-turn requests for saved recipes/brews are recognized without attachments. |
| State | Server-owned transcript, partial plans, validated drafts and array replacement remain. Accepted constraints must survive revisions. Read results are not new persistence and records must be retrieved again on later turns. |
| Provider loop | Existing call/tool/token/input/output budgets, accounting hooks, truncation handling and redacted errors remain. Account discovery/history consumes these existing budgets. |
| Domain | Calculations, feasibility and validation stay in shared workflows/core. Historical web intake normalizers are retained for now; relocating or removing all of them would be a separate untested rewrite. |
| Routing/repair | Recipe/yeast first-tool forcing and the deferred-draft retry/default-injection prompt have been removed after evaluation. Wiki search/fetch, catalog recovery and deterministic draft rendering remain. Stabilizer calculator walkthroughs no longer trigger process routing solely by mentioning stabilizers. |
| Access/accounting | Beta/access/payment restrictions, credit reservations/checkpoints/settlement, thread persistence and write confirmation keep their implementation. MCP account permissions are not bypassed by adding hosted reads. |

## Complete results and capability limits

Shared recipe reads return primary and backsweetened gravity, finished
ABV/Delle, volumes/losses, stabilization components and calculated nutrients.
Calculation context supplies units, configured pH versus assumed pH, and the
separation between fermentation FG, finished gravity and actual brew readings.
Sorbate and sulfite are separate components; Campden is an alternative sulfite
form. An unfamiliar amount is not evidence of a dosing error or guaranteed
stability. Guidance must use fetched canonical wiki pages, with disagreements
and retrieval gaps stated honestly. Candidate references are not fetched evidence.

Brew reads use the saved snapshot and latest visible readings with provenance;
timeline pages expose recorded additions/measurements, corrections and coverage.
Missing snapshot, gravity, pH or recorded nutrient additions are unknown, not
zero. One latest reading or a bounded page cannot establish stable gravity or
prove no additions occurred. Freeform names/notes/source text remain untrusted.

Saved advanced nutrient settings can be read and used by the shared derived
engine. Draft tools support basic yeast/schedule/addition-count/Go-Ferm choices,
but cannot edit or promise to preserve custom caps, YAN contributions, provided
YAN, offsets or manual yeast amounts. Shared result metadata and policy state
that limitation; those edits belong in the recipe editor. Reads do not expand
draft capabilities.

## Deterministic evidence

`apps/web/lib/ai/chat-account-tools.test.ts` covers hosted/MCP read parity,
complete derived calculations, units and nutrient limitations; discovery by
name without attachments; duplicate-name clarification; optional picker hints;
paged brew history; and proposals after owned reads. It also checks missing
adapters and failed-read target invalidation. These are scripted model responses,
not evidence that a real model chooses the correct steps.

`chat-account-boundary.test.ts` runs the actual application adapter with mocked
Prisma methods, checking hosted ownership independently of MCP, unavailable
foreign records, rejected owner injection, minimal picker results and unknown
measurements. Existing MCP adapter/protocol, recipe revision, yeast substitution,
wiki retrieval, billing and provider-budget regressions remain applicable.

The chat route only gains its authenticated adapter dependency. No request or
HTTP response schema changes. Run contract/OpenAPI generation and API-contract
verification and review generated artifacts even when unchanged. No database
schema/migration changes. The English log-deletion typo follows normal Weblate
translation handling.

## Required real-model evidence before PR consideration

Test the baseline and candidate against the same data and prompts; hold model
and settings fixed for the first comparison. Keep visible exchanges, tool
sequences, returned calculations, citations, latency, token use and provider
cost. Review actual conversations together; do not replace that review with a
mock-test pass or a model-generated score.

Use these multi-turn scenarios:

1. Find an owned private recipe by name, disambiguate duplicate names, and
   analyze its full calculations without a UI attachment.
2. Look up a yeast substitute, explain the grounded tradeoff, then revise an
   unsaved draft while keeping accepted amounts, stages and opt-outs.
3. Change fruit/additives across several turns; verify removals and substitutions
   persist and only a validated completed draft is presented as saveable.
4. Explain stabilization calculations and their pH/volume assumptions; fetch and
   cite canonical wiki guidance, distinguish sorbate/sulfite/Campden and explain
   conflicting or absent evidence without inventing a correction.
5. Read saved advanced nutrient caps, then request a cap change; explain the
   drafting limitation without pretending it was changed or preserved.
6. Find a brew, page through recorded additions with incomplete measurements,
   ask only useful missing-data questions, and prepare an explicitly requested
   note without saving it. A subsequent unrelated request must remain out of scope.

Successful MCP conversations supplied later can become matched replay cases.
Keep their qualitative provenance explicit. Existing-key reuse is approved;
no real-model evaluation spend is approved yet. Before a run, agree on model,
expected turns and spend. No PR, push or quality claim before reviewing results.

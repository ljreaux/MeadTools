# MCP parent #450 closure review

Review date: 2026-10-14 (America/Chicago). Checkout:
`/Users/larryreaux/Developer/MeadTools`, branch
`450-add-owned-brew-and-saved-recipe-read-tools-to-the-paid-mcp`.
The initial checkout was clean at `f093ba693`; branch and worktree inventory
were inspected before changes. No branch/worktree changes were made.

## Recommendation and findings by severity

**Ready for PR review following user-confirmed Preview testing.** On
2026-10-15 the user explicitly confirmed that the outstanding ChatGPT and Claude
account-read checks work, including consent, legacy grants, pagination,
revocation/reconnect and denials. The earlier P1 evidence gap is resolved by
this manual confirmation; it is not an independently captured automated trace.
Client builds and deployment revisions were not supplied. The canonical-link
fix still needs normal PR review and verification on its Preview deployment
before [#450](https://github.com/ljreaux/MeadTools/issues/450) closes.

- **P1 — resolved by user confirmation (2026-10-15):** the user confirmed the
  previously outstanding Preview flows work. See the dated follow-up in the
  [testing plan](mcp-client-testing-plan.md). No automated real-model evaluation
  was run for this review.
- **P2 — fixed in this checkout:** saved recipe/brew results omitted canonical
  application links, preventing an assistant from answering a recipe-link
  request reliably. Lists and details now return `appUrl`, authored by the
  authenticated application adapter from `publicAppOrigin()`, shared with
  OAuth. No model-selected owner, host header, or stored text supplies the URL.
  Private links confer no access and retain application authentication and
  visibility rules. Four SDK origin regressions failed before the fix and pass
  after it. This change still needs review and Preview verification before it
  can be counted as released.

No additional concrete code blocker was identified in the reviewed read-only
scope. This is not a claim of verified behavior in every remote client.

## Reviewed implementation and issue state

- [#451](https://github.com/ljreaux/MeadTools/issues/451) is closed by merged
  [PR #455](https://github.com/ljreaux/MeadTools/pull/455), commit `72489bb9e`.
  Its description explicitly leaves Preview PostgreSQL/Claude/ChatGPT checks
  pending and reports local Claude testing through a tunnel.
- [#452](https://github.com/ljreaux/MeadTools/issues/452) is closed after merged
  [PR #453](https://github.com/ljreaux/MeadTools/pull/453), commit `11e3d21c3`.
  Its description explicitly does not complete the private-read rollout gate;
  it reports local Codex sign-in and consent through a tunnel.
- Both PRs' web quality and mobile checks pass. Their Vercel deployments are
  reported ready. Deployment readiness is not evidence of client acceptance.
  Both merges are present in this checkout.

Reviewed repository/web instructions, account-read contracts, MCP client plan,
premium-launch documentation, actual recipe/brew page routes and access paths,
shared projections/execution, authentication/OAuth/consent, MCP transport/usage,
fixtures, additive token-scope migration, and API-contract workflow.

## Parent acceptance assessment

The remaining-evidence column below records the initial 2026-10-14 assessment.
The user's 2026-10-15 confirmation supersedes the outstanding client-flow checks;
client build/revision metadata remains unrecorded. The new link changes are
still local to this PR and require their own Preview check.

| Criterion                                                  | Verified implementation / deterministic evidence                                                                                                                                                                                                                                                                                                                                                                                                                              | Remaining evidence                                                                                          |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| All five tools, bounded typed results                      | SDK discovery returns twelve tools for account-read grants and seven for legacy grants; all five execute through the authenticated adapter. Strict inputs reject identity injection; outputs are allowlisted and bounded.                                                                                                                                                                                                                                                     | Actual supported client inventory and successful private reads on the reviewed Preview revision.            |
| Owned detail, private recipes, deterministic lists/history | Each query constrains authenticated ownership. Foreign/missing IDs both return `not_found` without details or links. Private recipes are included. Query-boundary `limit + 1`, ID ordering for lists, timestamp/UUID keysets for history. Mocked query checks plus real PostgreSQL multi-page/duplicate-name/offset/microsecond checks pass.                                                                                                                                  | Preview client continuation behavior and foreign/private denial scenarios; local PostgreSQL is not Preview. |
| Estimates, targets, measurements, additions stay distinct  | Full canonical shared calculation path exposes backsweetened FG, finished ABV/Delle, stabilization, nutrient/YAN/Go-Ferm plans and primary/secondary/bottling losses. `recipeTargets.finalGravitySg` is pre-backsweetening FG. Calculation context discloses configured pH and default/saved nutrient basis. Entries keep timestamps, units, reading roles, correction provenance and recorded amounts separate from recipe plans. Unknown legacy provenance remains unknown. | Client interpretation and wiki-backed answers on Preview.                                                   |
| Batch uses snapshot                                        | Brew calculation reads only saved snapshot data. Real PostgreSQL fixture uses a source recipe with changed FG and proves the brew retains its earlier snapshot FG.                                                                                                                                                                                                                                                                                                            | Preview observation on a representative saved batch.                                                        |
| Authenticated identity only                                | Adapter closes over user identity from per-request authentication; schemas accept no user/owner ID; all continuations reapply ownership.                                                                                                                                                                                                                                                                                                                                      | No new identity mechanism required.                                                                         |
| Existing credentials do not silently gain access           | `mcp:tools` remains basic-only. Personal-token opt-in defaults false; migration defaults existing tokens to basic scope. Consent defaults basic, cannot exceed signed requested scopes, and binds issued code/token scope. Refresh can preserve/reduce, never expand. Discovery and HTTP/direct SDK invocation enforce permission.                                                                                                                                            | Legacy/new connections, consent selection, refresh and reconnect in both Preview clients.                   |
| No domain writes; normal bookkeeping                       | Adapter exposes only reads. Fixtures prove source objects unchanged; real PostgreSQL comparison proves recipes/brews/entries unchanged. Operational token timestamps, rate buckets, leases and metadata-only usage logs remain separate. MCP does not invoke hosted-chat credit charging.                                                                                                                                                                                     | Preview operational smoke check; no writable capability needed.                                             |
| Limits, validation, legacy/protocol                        | Lists default 10/cap 20; arguments cap request size at 16 KiB; recipe inputs cap at 24 KiB, account execution at 28 KiB, transport result at 64 KiB including structured/text duplication. Rate 60/minute, concurrency 2, execution timeout 25 seconds. Tests cover denial and bounded output. Missing/legacy/oversized recipe data is explicitly unsupported; truncated text is disclosed; hidden bookkeeping excluded before pagination. No backfill occurs.                | Actual client handling of errors/pagination and Preview representative data.                                |
| Preserve seven tools and safeguards                        | Seven original tools retain successful shared execution without an account adapter. Wiki retrieval remains constrained. Revocation, expiry, resource binding, active user, premium/payment restrictions and kill switch are enforced before server creation. Deterministic permission/consent fixtures and PostgreSQL premium-foundation checks pass.                                                                                                                         | Preview legacy inventory, revocation/reconnect and entitlement/kill-switch denial checks.                   |

Wiki server instructions and detail descriptions require relevant search/fetch
before advice and citations of fetched canonical URLs. `relatedGuidance` is
explicitly catalog references, not fetched evidence; only reviewed catalog URLs
are selected from typed context. Injection tests preserve that isolation.
Names, notes, recipe text and fetched pages remain untrusted reference content.
The server cannot guarantee an external assistant follows its instructions.

## Evidence levels

**Verified during this review:** full repository deterministic suites and
workspace typecheck; SDK fixtures for all five tools/permission filtering and
canonical links across four origins; all seven original tool executions;
contract/OpenAPI regeneration with no generated diff; package boundaries;
release-note validation; targeted ESLint; VS Code bundled Prettier using
`trailingComma: none`; whitespace checks. The separate disposable PostgreSQL 16
database accepted all reviewed migrations and passed 15 premium-foundation
tests. The new `verify-mcp-account-reads-postgres.mjs` fixture passed the account
read checks described above. Its synthetic records were removed and its test
container was stopped/removed. No application development database was reset.

**Reported manual testing:** PR #453 records local Codex OAuth/consent; PR #455
records local Claude recipe/brew reads, wiki-backed analysis and unsaved drafts
through an HTTPS tunnel. During this review the user additionally reported
Preview testing with Claude using Sonnet 5.5, all tools working well. This is
positive manual tool-use evidence, not an independently captured trace.
Sonnet 5.5 is the reported model; the client build/version and detailed cases
were not supplied. Do not promote aggregate success to every matrix row.

**Manual follow-up — 2026-10-15:** the user quoted the outstanding P1 client
verification finding and confirmed "everything works," then authorized pushing
this branch and creating a PR. Record the ChatGPT and Claude account-read,
consent, legacy-grant, pagination, revocation/reconnect and denial checks as
user-confirmed. This supersedes the earlier lack of manual confirmation; it
adds no client build, deployment revision or independent trace.

**Outstanding:** PR review and Preview retest of the new canonical links,
including owner navigation and private access denial when signed out. The
existing additive token-scope migration applies in the disposable database;
this review did not independently inspect Preview's migration state.

## Scope and next steps

Push this existing branch and open a PR to Preview as requested. After review
and the canonical-link Preview check, #450 can close based on the deterministic
evidence and user-confirmed client checks. Do not merge or close automatically.
The link change adds no API route or database schema change, and generated HTTP
contracts/OpenAPI remain unchanged.

Advanced nutrient drafting, hosted-bot simplification
[#454](https://github.com/ljreaux/MeadTools/issues/454), new hosted-chat
integration and all writable capabilities remain separate. No safeguards were
relaxed, no credentials/environment values were inspected, and no automated
provider calls were made.

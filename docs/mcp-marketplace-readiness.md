# MCP marketplace readiness — issue #475

Preparation started November 7, 2026. This is an internal tracker, not a claim
that MeadTools is listed or approved. Requirements must be checked again before
submission. [Issue #475](https://github.com/ljreaux/MeadTools/issues/475) owns this
work; [#474](https://github.com/ljreaux/MeadTools/issues/474) owns launch activation.

## Release boundaries

Confirmed November 7: Larry chose to finish preparation now, deploy the reviewed
marketplace-readiness changes in the December 2026 release, and submit to the
selected marketplaces after that release and production verification. This work
is not part of the November 9 correction PR #508. Store approval dates remain
outside the release commitment.

- Keep the [existing setup page](https://meadtools.com/integrations/mcp) and custom
  OAuth connections as the November launch path.
- November 9 activation is still pending in #474 as of this assessment. Create
  reviewer accounts and verify production access after that activation. Do not
  introduce a reviewer bypass or enable premium/MCP early.
- Ship marketplace implementation changes through the December 2026 release.
  Submit after dependent production changes and review materials are ready.
- Publish availability claims and listing links only after approval and a verified
  connection path. Store review dates are not release commitments.

## Destination tracker

Alternative distribution is tracked in [plugin distribution](mcp-plugin-distribution.md).
The guide now has preview customer ZIP downloads: a real Claude remote-connector
plugin and a permission-dependent ChatGPT upload candidate. These downloads do
not imply store approval or a verified ZIP-import flow. No marketplace repository
has been published; the existing manual OAuth connector setup remains available.

An available submission route is not evidence of MeadTools eligibility or approval.
Account access, policy fit, and the released integration still need verification.
Maintenance owner is unassigned for every destination; name one before submission.

| Priority / destination | Eligibility and official requirements | Implementation gaps / next action | Submitted | Review status | Live listing |
| --- | --- | --- | --- | --- | --- |
| Primary: ChatGPT plugin directory | [OpenAI submission guide](https://developers.openai.com/plugins/deploy/submission), checked Nov 7. Remote MCP route exists; publisher identity, role, and policy eligibility unverified. | Prepare ZIP with MCP connection, verify domain and OAuth configuration, resolve portal scan findings, complete materials below. Domain challenge implementation depends on the portal's actual instructions. | Not submitted | Preparation | None |
| Primary: Claude Connectors Directory | [Claude submission guide](https://claude.com/docs/connectors/building/submission), checked Nov 7. Remote OAuth connector route exists; paid-plan submission access and policy eligibility unverified. | Deploy tool titles in December; verify every tool and production OAuth; prepare populated reviewer account and listing materials. | Not submitted | Preparation | None |
| Secondary candidate: official MCP Registry | [Remote-server guide](https://modelcontextprotocol.io/registry/remote-servers). Requirements not yet rechecked. Discovery registry, not a chatbot marketplace. | Decide whether to include; audit released metadata and ownership verification before implementing registry-specific changes. | Not submitted | Deferred evaluation | None |
| Secondary candidate: Smithery | [Publishing guide](https://smithery.ai/docs/build/publish). Requirements not yet rechecked. | Decide whether to include; investigate client-registration compatibility only if selected. | Not submitted | Deferred evaluation | None |
| Additional: Gemini, Grok, Perplexity | No public marketplace submission route verified in this assessment. | Establish an official listing route and verify client behavior before adding targets. Custom connection support alone is insufficient. | Not submitted | Deferred evaluation | None |

Cursor, VS Code, and coding-assistant marketplaces are outside this issue.
Incidental Codex availability through OpenAI's shared directory adds no separate
target or developer-client installation work.

## Requirements checked November 7

### OpenAI

The [submission guide](https://developers.openai.com/plugins/deploy/submission)
requires verified publishing identity and suitable organization permissions,
a plugin ZIP containing the MCP connection, a stable public HTTPS endpoint,
domain verification and successful MCP setup. Prepare website, support, privacy,
and terms URLs, accurate metadata and assets. Review materials include a dedicated
working sample account, five positive cases, three negative cases, a walkthrough
video, and release notes. Keep credentials outside the package in private review
fields. Recheck the linked package, authentication, policy, and MCP review guides
before constructing the package; this tracker does not establish compliance.

### Claude

The [submission guide](https://claude.com/docs/connectors/building/submission)
supports remote HTTPS MCP connectors through its developer portal. Authenticated
services use OAuth. Every tool needs a readable `title` and applicable read-only
or destructive annotations. Prepare documentation/privacy URLs, support contact,
icon, listing copy, use cases, company/contact details, and populated reviewer
access. Verify the tool inventory and attest to testing it. Screenshot carousel
requirements apply to MCP Apps with interactive UI; this tools-only submission
does not add an MCP App UI. Recheck policy and review criteria before submission.

## Implementation and evidence

| Item | State / evidence | Release or verification gate |
| --- | --- | --- |
| Tool titles | This change adds explicit titles in shared `mcpAgentToolDefinitions` and returns them through `tools/list`. | December 2026 release; local changes are not deployment evidence. |
| Tool annotations and permission filtering | Read-only/non-destructive annotations retained. Public community reads now use `openWorldHint: true`; bounded private/account/catalog/wiki tools remain false. Offline SDK fixtures check both permission levels and preserve scope denials. | Reproduced incorrect public annotations before fixing. Public-tool correction applies only when #509 is deployed; titles do not require those tools to ship. |
| OAuth and revocation | Prior client evidence is in [client testing](mcp-client-testing-plan.md); [Nov 6 ChatGPT public-read retest](mcp-public-client-retest.md) used local synthetic fixtures. | Neither proves the final production store-review path. Recheck each selected client after launch and December changes. |
| Production endpoint | `https://meadtools.com/mcp`. November 7 anonymous checks confirmed both OAuth discovery documents and a 401 challenge; public documentation/policy/support URLs returned 200. | Full OAuth, entitlement and reviewer-case checks remain pending. See [submission materials](mcp-marketplace-submission-materials.md). |
| Public discovery metadata | Server-card description now includes unsaved drafting and permission-based owned reads, which are already part of the established surface. | Local metadata update; verify after the chosen deployment. |
| Publisher/domain verification | Not checked in authenticated portals. | Determine the actual challenge; add code only if needed. |
| Policy and submission account eligibility | Not established. | Review both stores' current policies, including applicability to mead/brewing guidance, and verify publisher access before submission. |
| Package and listing drafts | [OpenAI source and archive instructions](../integrations/chatgpt/README.md), [Claude worksheet](../integrations/claude/listing.md), five positive/three negative cases, exact original-brand square icons and downloadable draft ZIPs are prepared. Larry selected individual publishing, all store-supported countries and existing-account access without chatbot sales/upsells. Additive privacy wording is prepared in the existing policy source. | Owner policy review/deployment, identity verification, recording and final production reviewer/portal checks remain. OpenAI's documented auth extension is rejected by the portable schema; full portal validation remains pending. Draft archives are not submission-ready. |

No changes under `app/api/`, database changes, production settings, reviewer
accounts, portal uploads, or model-provider calls are part of this first slice.

## Materials and reviewer checklist

- [ ] Name the submission and ongoing maintenance owner for each selected store.
- [ ] Draft name, short/long descriptions, icon, supported use cases and accurate
  tool inventory from the production candidate. Avoid unsupported client claims.
- [ ] Verify public setup, documentation, support, privacy and terms links and
  required image formats/dimensions against each current portal.
- [ ] Verify current pricing and premium requirements. Explain separately that
  external model usage is billed by the chatbot provider and does not consume
  MeadTools hosted-chat prompt credits.
- [ ] Prepare five OpenAI positive scenarios: catalog lookup; wiki retrieval;
  validated gravity/ABV calculation; unsaved recipe drafting; optional owned-brew
  retrieval after explicit account-read consent. Record exact prompts, expected
  tools and expected results against fictional data before review.
- [ ] Run the three drafted OpenAI negative prompts: save a recipe, buy supplies,
  and control a fermentation chamber. They test unsupported capabilities.
  Verify entitlement, revocation and scope denial separately as security checks.
- [ ] After November 9 activation, create a separate normal email/password
  account per store, with no administrator role, manual complimentary premium
  entitlement, and fictional recipes/brews. Keep access valid for rechecks.
- [ ] Verify fresh-session production sign-in and consent without purchase,
  magic links, codes, MFA approval or private networking. Enter credentials only
  in private reviewer fields, never in this repository or public issue updates.
- [ ] After December deployment, record production SHA/date, client/build, scope,
  connection, discovery, representative calls, revocation, reconnect and denial
  results. Exercise every tool for Claude; preserve owned-data consent/ownership.
- [ ] Run review cases and record walkthrough materials using reviewer data.
  Automated real-model evaluations require explicit approval of model, turns
  and expected spend; deterministic checks do not imply provider approval.
- [ ] Submit only when all dependent gates pass; update the destination row with
  submission date, feedback, follow-up and private-portal status without secrets.
- [ ] After approval, verify discovery/installation and OAuth end to end, then
  update setup/product copy through the applicable release workflow with the
  verified listing URL. Recheck after tool, authentication or policy changes.

## Deterministic checks for this slice

From the repository root:

```sh
npm run test:recipe-agent
node --import tsx --test apps/web/lib/mcp/permissions.test.ts
npm run typecheck --workspace @meadtools/recipe-agent
npm run typecheck --workspace @meadtools/web
```

The protocol fixture uses in-memory SDK transports and mocked persistence;
it makes no network, database or model-provider calls. It reproduced missing
titles before the fix. It does not verify store eligibility or production access.

November 7 result: all 75 recipe-agent tests and all 15 web MCP tests passed
(`node --import tsx --test apps/web/lib/mcp/*.test.ts`), including both permission
levels through the SDK. Recipe-agent and Web typechecks, package-boundary checks
and `git diff --check` passed. All 31 tools have titles; basic connections see
24 and explicitly authorized account-read connections see 31. No live client or
production recheck was performed in this slice.

Follow-up preparation: all 15 web MCP tests and the Web typecheck passed again
after the public-annotation correction. The standalone ABV and recipe-draft
review inputs were exercised directly without a provider. Anonymous production
discovery/denial checks are recorded in submission materials; authenticated
production calls and review cases remain unverified. The OpenAI manifest passed
its published schema and listing-length/case-count inspection. The portable MCP
core passed only with its documented OpenAI auth extension excluded from the
schema check; do not report full package validation as passed.

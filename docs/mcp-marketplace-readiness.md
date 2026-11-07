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
not imply store approval. Larry confirmed on November 7 that both plugin installs,
sign-in, tool discovery and invocation work. These checks are complete by user
confirmation; do not repeat the full MCP test without a relevant change. No marketplace repository
has been published; the existing manual OAuth connector setup remains available.

An available submission route is not evidence of MeadTools eligibility or approval.
Account access, policy fit, and the released integration still need verification.
Larry Reaux is the confirmed ongoing maintenance contact for ChatGPT and Claude,
using contact@meadtools.com. Assign an owner separately if secondary destinations
are selected.

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
| OAuth and client behavior | Prior client evidence is in [client testing](mcp-client-testing-plan.md); Larry additionally confirmed both installed plugins sign in, discover tools and invoke them. | General client-flow verification complete. Reviewer-account demonstration and a focused check of December metadata remain; repeat broader behavior only after a relevant change. |
| Production endpoint | `https://meadtools.com/mcp`. November 7 anonymous checks confirmed both OAuth discovery documents and a 401 challenge; public documentation/policy/support URLs returned 200. | General client behavior is user-confirmed. Dedicated reviewer access and exact submission-candidate evidence remain separate. See [submission materials](mcp-marketplace-submission-materials.md). |
| Public discovery metadata | Server-card description now includes unsaved drafting and permission-based owned reads, which are already part of the established surface. | Local metadata update; verify after the chosen deployment. |
| Publisher/domain verification | Larry completed OpenAI verification November 7; the organization settings now visibly show Verified. Both publishing portals are accessible. Claude's connector/listing form was inspected without entering data, selecting a connector or submitting; its dashboard still shows 0 submissions. | Identity/access checks complete. OpenAI's domain challenge is part of a publishing draft's MCP setup; no draft upload or domain change was made. |
| Policy and submission account eligibility | Not established. | Review both stores' current policies, including applicability to mead/brewing guidance, and verify publisher access before submission. |
| Package and listing drafts | [OpenAI source and archive instructions](../integrations/chatgpt/README.md), [Claude worksheet](../integrations/claude/listing.md), five positive/three negative cases, exact original-brand square icons and downloadable draft ZIPs are prepared. Larry selected individual publishing, all store-supported countries and existing-account access without chatbot sales/upsells. Larry approved the additive privacy wording November 7, then approved replacing the retention disclosure with a 30-day event-based deletion timeline. | Policy deployment, identity verification, recording and final reviewer/portal checks remain. OpenAI's documented auth extension is rejected by the portable schema; manual installation works per Larry, while public-submission portal validation remains pending. Draft archives are not submission-ready. |

No changes under `app/api/`, database changes, production settings, reviewer
accounts, portal uploads, or model-provider calls are part of this first slice.

## Materials and reviewer checklist

- [x] Name the submission and ongoing maintenance owner for the primary stores:
  Larry Reaux, contact@meadtools.com (confirmed November 7).
- [x] Record user-confirmed ChatGPT/Claude ZIP install, sign-in, tool discovery
  and invocation; no full retest required without a relevant change.
- [x] Owner review of the additive MCP privacy wording and the 30-day retention
  disclosure (approved November 7). Publication still follows December deployment.
- [x] Verify OpenAI publishing identity: organization settings visibly show
  Verified after Larry completed the process November 7. Publishing portal access
  was checked without uploading a draft or accepting attestations.
- [x] Verify Claude publishing access and inspect actual listing fields/categories
  without selecting a connector, filling fields or submitting (November 7).
- [ ] Draft name, short/long descriptions, icon, supported use cases and accurate
  tool inventory from the production candidate. Avoid unsupported client claims.
- [ ] Verify public setup, documentation, support, privacy and terms links and
  required image formats/dimensions against each current portal.
- [x] Verify current pricing and premium requirements. Explain separately that
  external model usage is billed by the chatbot provider and does not consume
  MeadTools hosted-chat prompt credits. Done November 7: access, pricing and
  age reviewer notes are in submission materials; prices stay out of listings.
- [x] Prepare five OpenAI positive scenarios: catalog lookup; wiki retrieval;
  validated gravity/ABV calculation; unsaved recipe drafting; optional owned-brew
  retrieval after explicit account-read consent. Exact prompts, expected tools
  and pass criteria are in the [run sheet](mcp-marketplace-recording-run-sheet.md);
  all five passed a local ChatGPT rehearsal on synthetic data November 7.
- [x] Rehearse the three OpenAI negative prompts (save, purchase, device
  control) locally: all passed November 7 with no write, order or device action.
  Production reruns remain under the post-December items below. Verify
  entitlement, revocation and scope denial separately as security checks.
- [x] Detailed production recording plan, reviewer-fixture specification and
  local rehearsal record (November 7). The rehearsal video is local-only and is
  not a submission recording.
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

## Remaining work — detailed (as of November 7, 2026)

Preparation that can be done before deployment is complete except for the
owner decisions in phase A. Everything else depends on November 9 activation,
the December release or the store portals. Requirement findings behind these
items are in [submission materials](mcp-marketplace-submission-materials.md#requirement-recheck--november-7-later).

### A. Owner decisions (no deployment needed)

1. **Alcohol / audience fit for OpenAI.** OpenAI requires plugins to suit users
   aged 13–17; MeadTools' terms require users to be at least 18 and the product
   concerns making alcohol. Alcohol is not on the published prohibited-goods
   list. Recommended: submit without a pre-review inquiry, keep copy about
   fermentation and calculations, and disclose the Terms' 18+ limit in the
   reviewer notes (draft wording in submission materials). Sign-up shows no
   age statement or check; Larry chose not to add one (November 7). This
   remains the largest unknown for OpenAI approval.
2. **Retention timelines — decided November 7.** Larry approved an event-based
   timeline: MCP records are kept while the account exists; verified deletion
   requests are completed within 30 days (manual SQL process). The privacy
   source is updated; it publishes with the December release. The operator
   routine and tested SQL are in [MCP data deletion requests](mcp-data-deletion-requests.md).
3. **Production manual-premium method — decided November 7.** Larry grants
   manual premium with reviewed SQL against production, as already done for
   launch. The upsert template is in the run sheet's reviewer-account section.
4. **Claude listing choices — confirmed November 7.** Slug `meadtools`
   (permanent once submitted), category Education (optionally Data &
   Analytics), with the server favicon or the prepared 512 × 512 icon.
5. **#509 public community tools ship in December — confirmed.** #509 is merged
   into `preview` and present in this branch, so the stores will scan all 31
   tools. Exercise the public search/detail/summary tools in the production
   checks (C.4), keep their `openWorldHint: true` (they return other users'
   public, untrusted content), and describe community discovery briefly in
   the listing copy. Do not show real users' public records in the recording.

### B. After November 9 activation (#474)

1. Create one production reviewer account per store as specified in the
   [run sheet](mcp-marketplace-recording-run-sheet.md#2-production-reviewer-account-after-november-9-activation):
   normal email/password, no admin role, no MFA/codes/magic links, manual
   premium valid well past review, fictional recipe and brew only.
2. Verify fresh-session sign-in and OAuth consent for each account against
   the current production server (custom connection), then disconnect.
3. Store credentials only in Larry's password manager; they are entered later
   in the portals' private reviewer fields.

### C. December release and production verification

1. Merge and deploy the December release containing PR #510 (titles,
   annotations, server description, privacy section, downloads). Record the
   production SHA and date here.
2. Set the privacy notice revision date to the deployment date; confirm the MCP
   section is live signed out.
3. Refresh the production ChatGPT and Claude connections; confirm every tool's
   title and hints and the server description.
4. Claude: exercise **every** tool once through MCP Inspector and as a Claude
   custom connector with the reviewer account (the portal asks you to confirm
   this). Record pass/fail per tool without private data.
5. Security spot checks on production: revoke then reconnect; basic-only
   connection cannot read owned records; a non-premium account is denied.
6. Audit one response from each account-read tool for extraneous internal
   fields (OpenAI minimization guidance).
7. Rebuild both ZIPs from the released sources (`npm run mcp:package
   --workspace @meadtools/web`) and confirm they match what was reviewed.

### D. Submission recording (after C)

1. Follow the run sheet's preconditions, capture setup and per-prompt routine
   against the production plugin and the OpenAI reviewer account.
2. Verify the file (legibility, coverage, no secrets), host it at a URL Larry
   controls, confirm signed-out playback.
3. Add the URL to `review.demo_recording_url`, rebuild the OpenAI ZIP.

### E. OpenAI submission

1. In the publishing portal, create the draft with the rebuilt ZIP; complete the
   domain challenge it issues by serving the token at
   `/.well-known/openai-apps-challenge` (a small hosted-file change through the
   normal release workflow if the app cannot already serve it).
2. Run **Scan Tools**; resolve findings. Confirm the auth configuration accepted
   by the portal (the documented auth extension fails the portable schema
   locally; manual installation works).
3. Enter reviewer credentials, login URL and instructions in Review details;
   rerun all five positive and three negative cases with that account and
   confirm results match the manifest.
4. Confirm commerce is off, countries are all supported, publisher is Larry
   Reaux (individual), support contact is set; submit. Record the date here.

### F. Claude submission

1. In `claude.ai/directory/manage`, create the listing with the production MCP
   URL and the approved copy, icon, slug and categories.
2. Enter reviewer credentials and steps in Test & launch; confirm every tool was
   exercised (C.4). Submit and record the date and its Community/review status.

### G. After submission and approval

1. Respond to reviewer feedback; corrections are new OpenAI ZIPs (one active
   review at a time). Escalations for Claude go to mcp-review@anthropic.com.
2. After approval, verify install from the listing, OAuth and one tool call in a
   fresh account; then update the setup page and product copy with the verified
   listing links through the normal release workflow.
3. Keep reviewer accounts valid; extend their manual entitlement before expiry.
4. Recheck listings after any tool, authentication or policy change. Published
   OpenAI MCP tool changes are rescanned daily; metadata changes need a new ZIP.
   The MCP origin cannot change after OpenAI publication.

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

# MCP submission materials — draft

Prepared November 7, 2026 for #475. No submission, approval, production reviewer
account, video recording, or release-date decision is implied. The OpenAI source
is in [integrations/chatgpt](../integrations/chatgpt/README.md); the overall gates
are in [marketplace readiness](mcp-marketplace-readiness.md).

## Publisher and scope

Larry chose individual publishing; intended public identity is Larry Reaux.
Verification and submission-account access remain unchecked. Larry selected
all countries supported by each store and confirmed existing-account access
only, without subscription sales, upgrade prompts or checkout in the chatbot.
The ongoing maintenance owner remains undecided. The first listing can describe
the already shipped calculators, catalog/wiki tools, recipe drafting and optional
owned reads without depending on #509's new public community tools. A store's
scan still sees everything in the deployed authorized inventory, so every
advertised tool must be reviewed and exercised before submission.

## Claude listing draft

- Name: **MeadTools**
- One-liner: **Develop mead recipes, calculate brewing quantities, and read your brewing records.**
- Documentation: <https://meadtools.com/integrations/mcp>
- Privacy policy: <https://meadtools.com/privacy-policy.html> — reachable;
  MCP-specific coverage still needs review and publication.
- Support: <https://meadtools.com/contact>, `contact@meadtools.com` as shown on
  the existing MeadTools about page. Verify the final portal contact.
- Icon: exact original-brand export in
  `integrations/chatgpt/meadtools/assets/logo.png`, 512 × 512 transparent PNG.
  A 128 × 128 composer icon is also prepared; neither is a generated redraw.
- Categories and permanent listing slug: choose from the actual portal options
  before submission, without assuming ChatGPT category names apply to Claude.

Description draft:

> MeadTools helps meadmakers draft recipes, calculate gravity targets and other
> brewing quantities, look up ingredients, additives and yeast, and retrieve
> brewing guidance from the MeadTools wiki. With explicit permission, the
> connection can also read your owned recipes, brews, timelines and sensor
> summaries. Calculated estimates are kept separate from recorded readings.
> Recipe drafts remain unsaved until you review and save them in MeadTools.
> The connection cannot save recipes, change brews, control devices or make
> purchases. Sign in with your existing eligible MeadTools account.

Use cases: recipe development; standalone brewing math; catalog and wiki lookup;
reading owned brewing records. This is a remote tools-only OAuth connector,
not an interactive MCP App. Do not add an MCP App screenshot carousel or promise
features not present in the production candidate. Final plan requirements belong
in prerequisite/reviewer fields; verify the current price separately from copy.

## Review case execution record

Exact five positive and three negative cases are in the OpenAI manifest. They
also provide a representative Claude walkthrough, but Claude's verification
must additionally exercise every tool in the actual scoped inventory.

| Case | Submitted-client status | Preparation evidence / setup |
| --- | --- | --- |
| P1 — Lalvin 71B lookup | Not run | Requires live production catalog and reviewer OAuth. |
| P2 — OG 1.100 / fermentation FG 1.000 ABV | Not run | Direct offline shared-tool execution returns 13.262156145051131% ABV. This does not prove model tool selection. |
| P3 — stabilization wiki retrieval | Not run | Needs production wiki retrieval with a canonical source link. |
| P4 — 1 US gal unsaved honey draft | Not run | Direct offline execution with the manifest's intended inputs returns `status: ok`, a recipe result and recipe data. Reviewer run must confirm actual yeast lookup, returned calculations and exact builder URL. |
| P5 — fictional owned brew readings | Blocked | Dedicated post-launch account and fictional brew not created. Needs explicit account-read consent. |
| N1 — save a recipe | Not run | No MCP write tool exists; client must explain the limit without claiming persistence. |
| N2 — order honey using saved payment | Not run | No purchase tool exists; do not substitute a catalog lookup for an order. |
| N3 — control a fermentation chamber | Not run | Read-only sensor tools do not change device settings. |

Security checks are additional to negative prompt cases: absent/expired/revoked
authorization; missing premium entitlement; basic-only access to owned tools;
foreign record IDs; revoke and reconnect; refresh behavior; basic consent after
declining account reads. Deterministic fixtures already cover these boundaries;
repeat the relevant production connection checks without exposing private data.

## Recording plan

Rehearse in the intended chatbot with a dedicated populated account after launch.
Use a clean conversation and show actual prompts, tool activity and returned
results. Keep all passwords, tokens, consent details that identify private
accounts, and unrelated records off screen.

1. Introduce MeadTools and the production candidate being demonstrated. Show
   connection completion without recording credential entry.
2. Run P1, then P2. Show the catalog identity and the approximately 13.26% ABV
   estimate with the stated fermentation gravity basis.
3. Run P3. Open or visibly inspect the returned source and distinguish fetched
   guidance from calculation output.
4. Run P4. Show the unsaved draft and exact returned review link; do not save it
   as part of demonstrating a read-only tool.
5. Run P5 with explicit owned-read permission. Show the fictional brew's recorded
   OG/FG and actual dates, keeping estimates separate from measurements.
6. Run N1–N3. Show the limit explanation with no fabricated write, purchase or
   device action. Demonstrate revocation/reconnect separately if useful.
7. Play back the saved video to check readability, coverage and absence of
   secrets, then host it at a reviewer-accessible URL and verify playback there.

Computer control is available for a visible walkthrough if Larry wants it, but
video capture has not been established. A script or screenshots do not count as
a recording. Larry can use his screen recorder while demonstrating the prompts;
the final accessible recording URL belongs in the manifest's
`review.demo_recording_url` only after verification. No real-model batch is
authorized; any automated provider run requires separate model/turn/spend approval.

## Privacy wording prepared for review

The production privacy and terms pages both returned 200 on November 7 and are
dated March 14, 2025. The privacy text inspected does not explicitly describe MCP
OAuth authorization or transfer of selected owned recipe/brew data to a chatbot.
The terms contain subscription provisions, but neither document is treated as
reviewed for this integration. Do not replace the full policies in this slice.

The canonical proposed wording is now an additive section in
[`apps/web/public/privacy-policy.html`](../apps/web/public/privacy-policy.html#mcp).
It preserves the existing policy and adds a top-of-page link to the MCP section.
This is uncommitted source for review, not a claim that the text is published.

It explains basic versus explicitly authorized account reads, the categories of
owned data sent to the connected AI service, recipient privacy controls,
connection/usage records, revocation and privacy contact routes. It distinguishes
the dedicated metadata-only usage recorder from the underlying saved recipes
and brewing records. It accurately discloses that there is no fixed automatic
age-based deletion schedule, and that revocation/account deactivation does not
erase stored history or the external service's copies.

The account operation named `deleteUser` was inspected and sets `active: false`;
it is not an MCP-data purge. No cleanup code or new retention promise is added.
Token expiry is not deletion. Before publication, review this wording against
actual support/backup operations and set the notice revision date to the actual
deployment date. If a store requires a specific retention period, resolve that
policy and any necessary implementation explicitly instead of inventing one.
The existing terms have not been rewritten or treated as newly approved.

HTML checks verified the unique section anchor/heading, disclosures and contact
and connection-control links. A live browser layout check was unavailable because
the existing localhost preview refused connections. No server was started or
replaced; no production policy was modified.

## Public endpoint checks — November 7

Without signing in or registering any OAuth client:

- Production setup, contact, privacy and terms pages returned 200. Setup content
  advertises the real MCP endpoint and existing connection flow. No form was sent.
- `/.well-known/oauth-authorization-server` returned 200 with production issuer,
  authorization/token/registration/revocation URLs, S256, public-client token
  exchange and both supported scopes.
- `/.well-known/oauth-protected-resource/mcp` returned 200 with the expected
  production resource, authorization server, documentation URL and scopes.
- Unauthenticated `GET /mcp` returned 401 with a resource-metadata challenge.

These checks prove public discovery and an anonymous denial only. They do not
prove active-user OAuth, entitlement, store eligibility, live invocation,
production SHA, reviewer access, domain verification or portal scan success.

## Official references checked

- [OpenAI package format](https://developers.openai.com/plugins/build/plugins)
- [OpenAI submission flow](https://developers.openai.com/plugins/deploy/submission)
- [OpenAI review requirements](https://developers.openai.com/plugins/deploy/app-review)
- [OpenAI plugin guidelines](https://developers.openai.com/plugins/plugin-guidelines)
- [Claude submission](https://claude.com/docs/connectors/building/submission)
- [Claude review checklist](https://claude.com/docs/connectors/building/review-criteria)

OpenAI currently permits access to an existing paid account but prohibits
in-plugin subscription selling/upsells and subscription promotions in listing
descriptions. The draft contains no purchase tool or promotional pricing copy.
Public/community reads use an open-world hint; private account and bounded
catalog/wiki tools remain closed-world. Neither policy fit nor review approval
is established by this interpretation; inspect actual portal findings later.

## Prepared changes and confirmed December schedule

The production code edits in this branch's uncommitted #475 diff are currently:

1. Shared explicit human-readable titles (31 existing branch tool names) and one
   `tools/list` title field in the web MCP adapter.
2. A corrected server-card description for unsaved drafting and optional owned
   reads already supported in the established surface.
3. A public-community open-world annotation correction for #509's tools.
4. Additive MCP privacy wording in the existing policy page.
5. Optional preview ZIP downloads and instructions in the existing setup guide,
   with static customer packages generated from the reviewed package sources.

Tests and preparation docs accompany these edits. Package/listing JSON files are
submission artifacts, not deployed endpoints. No database migration, entitlement
change, reviewer bypass, checkout change or new OAuth method is identified as
necessary by this audit. Domain verification may require a small hosted file or
DNS change once its actual challenge is known; no challenge is invented here.

Confirmed November 7: Larry chose to complete preparation now and submit to the
marketplaces after the December 2026 release. Deploy these changes through that
normal reviewed release, then verify the production candidate and submit when
the review materials, reviewer access and portal requirements are complete.
Do not include this work in November 9 correction PR #508. Owner review of the
privacy wording, final package/recording preparation, targeted client checks and
publisher/domain verification remain preparation or submission gates, not
promises of store approval on a particular date.

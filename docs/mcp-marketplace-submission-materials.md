# MCP submission materials — draft

Prepared November 7, 2026 for #475. No submission, approval, production reviewer
account or video recording is implied. The confirmed release target is December
2026, with marketplace submissions afterward. The OpenAI source
is in [integrations/chatgpt](../integrations/chatgpt/README.md); the overall gates
are in [marketplace readiness](mcp-marketplace-readiness.md).

## Publisher and scope

Larry chose individual publishing; intended public identity is Larry Reaux.
Larry completed OpenAI verification November 7; organization settings visibly
show Verified. The OpenAI publishing portal is accessible and offers ZIP upload.
No identity documents were inspected or submitted by the agent, no publishing
draft was uploaded and no legal attestation was accepted. Domain verification
is not yet complete: its challenge is supplied during the draft's MCP setup.
Larry then signed into Claude; its publishing portal and connector/listing form
are accessible. Read-only field/category inspection left the dashboard at
0 submissions. No connector was selected, fields entered or attestation accepted.
Larry selected
all countries supported by each store and confirmed existing-account access
only, without subscription sales, upgrade prompts or checkout in the chatbot.
Larry confirmed himself as the ongoing maintenance contact for both stores at
contact@meadtools.com. #509's public community tools are merged into
`preview` and ship in the December release, so the listing copy now also
describes public community recipe and brew discovery (updated November 7).
A store's scan sees everything in the deployed authorized inventory, so every
advertised tool must be reviewed and exercised before submission.

## Claude listing draft

- Name: **MeadTools**
- One-liner: **Develop mead recipes, calculate brewing quantities, and read your brewing records.**
- Documentation: <https://meadtools.com/integrations/mcp>
- Privacy policy: <https://meadtools.com/privacy-policy.html> — reachable;
  MCP-specific wording was approved by Larry November 7 and awaits deployment.
- Support: <https://meadtools.com/contact>, `contact@meadtools.com` as shown on
  the existing MeadTools about page and confirmed by Larry November 7.
- Icon: exact original-brand export in
  `integrations/chatgpt/meadtools/assets/logo.png`, 512 × 512 transparent PNG.
  A 128 × 128 composer icon is also prepared; neither is a generated redraw.
- Proposed Claude category: **Education**, confirmed as an actual portal option.
  **Data & Analytics** is also available if needed; the form allows up to five.
  No category was selected in the portal. OpenAI retains **Education & Research**.
- Proposed slug: **meadtools**, subject to availability and owner review before
  submission. The actual form says the slug is permanent after submission.
- Author name: **Larry Reaux**; author URL: <https://meadtools.com>.
- Icon handling: the inspected Claude form recommends the server favicon by
  default. A custom public icon URL is optional; the prepared square PNG remains
  available if a custom listing icon is chosen.

Description draft:

> MeadTools helps meadmakers draft recipes, calculate gravity targets and other
> brewing quantities, look up ingredients, additives and yeast, and retrieve
> brewing guidance from the MeadTools wiki, and search recipes and brew logs
> that MeadTools members have chosen to share publicly. With explicit permission, the
> connection can also read your owned recipes, brews, timelines and sensor
> summaries. Calculated estimates are kept separate from recorded readings.
> Recipe drafts remain unsaved until you review and save them in MeadTools.
> The connection cannot save recipes, change brews, control devices or make
> purchases. Sign in with your existing eligible MeadTools account.

Use cases: recipe development; standalone brewing math; catalog and wiki lookup;
discovering publicly shared community recipes and brews;
reading owned brewing records. This is a remote tools-only OAuth connector,
not an interactive MCP App. Do not add an MCP App screenshot carousel or promise
features not present in the production candidate. Final plan requirements belong
in prerequisite/reviewer fields; verify the current price separately from copy.

## Access, pricing and reviewer notes

Checked November 7 against `lib/mcp/access.ts`, `lib/db/premium-access.ts` and
the [premium launch decision](mcp-premium-launch.md). Store rules: OpenAI
listings must not advertise pricing, subscriptions, trials or discounts, and
the plugin must not display plans, start subscriptions or promote upgrades;
Claude tool descriptions must not promote products or services.

Facts the notes rely on:

- MCP sign-in requires an active MeadTools account with premium access
  (manual, Ko-fi or Stripe membership) and no payment restriction; otherwise
  OAuth is denied or tools return a premium-required result.
- MCP tool calls do not spend MeadTools hosted-chat prompt credits; the MCP
  path checks only account, premium and payment-restriction status.
- Model usage is billed or limited by the user's ChatGPT or Claude plan, not by
  MeadTools.
- No tool sells, upgrades, starts checkout or purchases supplies.

Keep price amounts out of listing descriptions, tool descriptions and default
prompts. Use this text only in prerequisite and private reviewer fields:

> **Access.** MeadTools tools require signing in with an existing MeadTools
> account that has MeadTools Premium. The connection does not sell
> subscriptions, show plans, promote upgrades, start checkout or buy anything.
> Model usage is covered by your ChatGPT or Claude plan; MeadTools tool calls do
> not consume MeadTools hosted-chat credits.
>
> **Reviewer account.** The supplied reviewer account has complimentary premium
> access and contains only fictional brewing data, including the private brew
> "Marketplace Review Traditional". Sign in at https://meadtools.com with the
> email and password provided, approve the connection, and choose account-read
> permission to exercise owned-record tools. No MFA, codes or magic links are
> required.
>
> **Age.** MeadTools' Terms of Service limit the service to people aged 18 and
> older. The connection reads and calculates brewing information; it does not
> sell, order or deliver alcohol.

The 18+ line describes the Terms; sign-up has no age statement or check, and
Larry chose not to add one in this slice (November 7).

## Review case execution record

Larry confirmed that both installed plugins sign in, discover tools and invoke
them successfully. That completes the general client-flow check; do not repeat
the full MCP matrix without a relevant change. The specific recorded submission
cases below still need captured outputs on fictional reviewer data; their status
does not negate the already confirmed connection behavior.

Exact five positive and three negative cases are in the OpenAI manifest. They
also provide a representative Claude walkthrough, but Claude's verification
must additionally exercise every tool in the actual scoped inventory.

Local rehearsal, November 7, 2026: regular ChatGPT web, thinking effort Medium
(the model name was not displayed), the **MeadTools Local Dev** plugin attached
to every prompt through the private OpenAI tunnel, and the synthetic local
review account `mcp-owned-review-demo@meadtools.test`. The local server log
recorded 18 successful `POST /mcp` calls, confirming that no prompt used the
production plugin. This is rehearsal evidence for the cases and recording plan,
not production or submission evidence: OpenAI review rejects local or testing
endpoints, so every case must be rerun against the deployed production candidate
with the store reviewer account.

| Case | Production (submission) status | Local rehearsal result, November 7 |
| --- | --- | --- |
| P1 — Lalvin 71B lookup | Not run | Pass. "Searched MeadTools Catalog"; Lalvin 71B, nitrogen requirement Low, 59–86 °F (15–30 °C), 14% tolerance. One tool call. |
| P2 — OG 1.100 / fermentation FG 1.000 ABV | Not run | Pass. "Calculated ABV"; 13.26% labeled as an estimate with the fermentation-FG basis before backsweetening. It did not separately say "not a laboratory measurement". One call. |
| P3 — stabilization wiki retrieval | Not run | Pass. Search plus fetch (two calls); supported summary and link to `wiki.meadtools.com/en/process/stabilization`; no dose calculated. |
| P4 — 1 US gal unsaved honey draft | Not run | Pass. Six calls including yeast lookup, draft and wiki guidance. "Unsaved draft calculated"; OG 1.100, FG 0.996, honey 2.846 lb, Go-Ferm 3.75 g, Fermaid O 4 × 1.206 g, no stabilizers; exact builder link with fragment, explicitly unsaved. |
| P5 — fictional owned brew readings | Not run (needs production reviewer account) | Pass on the synthetic local fixture. Three calls (list, details, timeline); OG 1.100 on September 12, 2026, fermentation FG 1.000 on October 10, 2026, recipe target 0.998 kept separate, returned brew link, synthetic label, no readiness claim. |
| N1 — save a recipe | Not run | Pass. No tool call; states nothing was saved. It speculated that a `create_recipe` tool would be needed. |
| N2 — order honey using saved payment | Not run | Pass. No tool call; "Order status: Not placed", "No charge made". It offered retailer search, which was not used. |
| N3 — control a fermentation chamber | Not run | Pass. One read of active brews; "Temperature not changed", no command sent. |
| Supplemental — synthetic public discovery | Not part of the manifest | Pass. Five public-read calls; both Raspberry Cheesecake batches; measured fermentation FG separate from estimated 1.0149 finished gravity; finished gravity and measured ABV "Not returned"; cohort 7/1, 6/2, 6/2 usable/missing with means 1.0751, 0.9992 and 68.83 days, matching the fixture document; labeled synthetic. |

ChatGPT appends `?utm_source=chatgpt.com` to returned links. Builder fragments
were preserved after that query parameter. The rehearsal video is a private
local file and must not be used as the submission recording.

Security checks are additional to negative prompt cases: absent/expired/revoked
authorization; missing premium entitlement; basic-only access to owned tools;
foreign record IDs; revoke and reconnect; refresh behavior; basic consent after
declining account reads. Deterministic fixtures already cover these boundaries;
repeat the relevant production connection checks without exposing private data.

## Recording plan

The detailed production plan is the
[recording run sheet](mcp-marketplace-recording-run-sheet.md). The November 7
local rehearsal proved the capture method (macOS `Shift–Command–5`, selected
region, no microphone), the operating sequence and the expected results above.
It produced a private local file only; no recording URL has been invented or
added to the package.

The submission recording is made after the December release, against the
production MeadTools plugin and the OpenAI store reviewer account. It shows
connection completion without credential entry, P1–P5 and N1–N3 in order, the
tool activity for each, and returned links. Its accessible URL belongs in the
manifest's `review.demo_recording_url` only after signed-out playback is
verified. An agent may operate ChatGPT while Larry records only with explicit
approval naming the model, expected turns (about nine) and expected spend.

## Privacy wording approved; publication pending

The production privacy and terms pages both returned 200 on November 7 and are
dated March 14, 2025. The privacy text inspected does not explicitly describe MCP
OAuth authorization or transfer of selected owned recipe/brew data to a chatbot.
The terms contain subscription provisions, but neither document is treated as
reviewed for this integration. Do not replace the full policies in this slice.

The canonical proposed wording is now an additive section in
[`apps/web/public/privacy-policy.html`](../apps/web/public/privacy-policy.html#mcp).
It preserves the existing policy and adds a top-of-page link to the MCP section.
Larry approved the wording on November 7 and later the same day approved an
event-based retention timeline (below). It
is source in PR #510 awaiting the December release, not a claim that the text is
already published. No additional retention cleanup was requested.

It explains basic versus explicitly authorized account reads, the categories of
owned data sent to the connected AI service, recipient privacy controls,
connection/usage records, revocation and privacy contact routes. It distinguishes
the dedicated metadata-only usage recorder from the underlying saved recipes
and brewing records. Revocation and account deactivation do not erase stored
history or the external service's copies.

**Retention timeline revised November 7 (Larry approved).** To meet OpenAI's
expectation of stated retention timelines without new cleanup code, the MCP
section now states an event-based timeline: MCP authorization and usage records
are kept for as long as the account exists, and verified deletion requests are
completed within 30 days, except information kept for legal obligations,
disputes or abuse prevention. Backup copies follow the general
"How long do we keep your information?" section, which already covers backup
archives. This replaces the earlier "no fixed automatic deletion schedule"
sentence.

The account operation named `deleteUser` was inspected and sets `active: false`;
it is not an MCP-data purge. Deletion requests are fulfilled manually (Larry
already operates production by reviewed SQL); the 30-day commitment therefore
depends on that manual process being followed. A request must remove the
account's `mcp_oauth_sessions`, `mcp_oauth_codes`, `mcp_access_tokens`,
`mcp_tool_usage`, `mcp_tool_leases` and `mcp_rate_buckets` rows along with the
account. The step-by-step routine and SQL, dry-run tested locally, are in
[MCP data deletion requests](mcp-data-deletion-requests.md). Token expiry is not
deletion. Set the notice revision date to the actual deployment date before
publication.
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

### Requirement recheck — November 7 (later)

The five references above were reread after the local rehearsal. None
mentions alcohol, homebrewing or age-restricted goods by name. Findings that
change or sharpen the remaining work:

- **Production endpoint only (OpenAI).** Review requires a publicly accessible
  domain and states the app must not use a local or testing endpoint. The local
  rehearsal therefore cannot be the submission video or case evidence.
- **General-audience suitability (OpenAI).** Plugins must be suitable for users
  aged 13–17. MeadTools' terms restrict use to people at least 18, and the
  product is about producing alcohol. The prohibited-goods list (tobacco,
  cannabis, prescription drugs, weapons) does not name alcohol, so this is an
  unresolved policy-fit question, not a known rejection. Recommended approach:
  submit without a pre-review inquiry, keep listing copy about fermentation,
  recipes and calculations (no drinking, serving or effects language), and
  disclose the age requirement in the reviewer notes (draft below).
- **Retention timelines (OpenAI) — addressed.** The MCP privacy section now
  states an event-based timeline (kept while the account exists; verified
  deletion requests completed within 30 days). See the privacy section above.

**Age requirement — where it is stated (checked November 7).** The Terms of
Service say the services are intended for users at least 18 and that people
under 18 may not use or register. The privacy policy says MeadTools does not
knowingly collect data from children under 18. The web sign-up page and form
(`app/[locale]/register`, `AuthForm`) show no age statement, terms link or
acceptance checkbox, and there is no age check. Accurate reviewer-note wording,
without implying enforcement that does not exist:

> Using this connection requires an existing MeadTools account. MeadTools' Terms
> of Service limit the service to people aged 18 and older. The connection reads
> and calculates brewing information; it does not sell, order or deliver
> alcohol.

Do not describe accounts as "verified adults" or "age-gated". An explicit
sign-up statement (for example, "By creating an account you confirm you are at
least 18 and agree to the Terms of Service and Privacy Policy", with links) is
an optional product change outside this slice; it needs English strings and
the normal German translation workflow.
- **Response minimization (OpenAI).** Audit tool responses for internal IDs,
  timestamps and debug fields that are not strictly needed. Record IDs used for
  follow-up calls are justified; confirm nothing else is extraneous.
- **Reviewer account (both).** A fully populated demo account with sample data,
  no MFA, codes, magic links or private networking, usable without further
  setup and kept valid for later reviews. OpenAI collects credentials in the
  portal's Review details; Claude in its Test & launch step.
- **Test coverage (Claude).** The portal asks for confirmation that every tool
  was exercised through MCP Inspector and as a Claude custom connector.
  Tool descriptions must not promote products or instruct calls to other tools.
- **Assets (OpenAI).** Logo required; PNG, JPEG, WebP or SVG up to 5 MiB, square
  icons at least 48 × 48, raster at most 4096 px per side. The prepared
  512 × 512 PNG fits. Claude requires an icon but states no size.
- **Domain (OpenAI).** Host the exact challenge token as plain text at
  `/.well-known/openai-apps-challenge` on the challenge host; the token appears
  during draft MCP setup. Once published, the MCP origin cannot change.
- **Process.** One active OpenAI review per plugin; corrections are new ZIPs;
  published MCP tool changes are rescanned daily. Claude submissions are
  auto-scanned and listed as Community by default; the slug is permanent.
- **Naming.** Do not append "MCP" or "Plugin" to the product name.

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

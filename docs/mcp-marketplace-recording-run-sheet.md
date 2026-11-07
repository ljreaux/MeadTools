# MeadTools marketplace walkthrough — recording plan

Prepared November 7, 2026 for #475; revised after the same-day local rehearsal.
The **submission recording is made after the December 2026 release** against the
production MeadTools plugin and the OpenAI store reviewer account. OpenAI review
rejects local or testing endpoints, so the local rehearsal described at the end
is preparation evidence only. Claude's directory does not currently require a
video; the same prompts support its reviewer notes.

Overall gates are in [marketplace readiness](mcp-marketplace-readiness.md);
case evidence and policy findings are in
[submission materials](mcp-marketplace-submission-materials.md).

## 1. Preconditions (all must be true before recording)

| # | Precondition | How to confirm |
| --- | --- | --- |
| 1 | December release is deployed to production and its commit SHA/date is recorded. | Vercel production deployment and `main` SHA noted in the readiness tracker. |
| 2 | Production MCP metadata is correct: every tool has a title and explicit read-only/destructive/open-world hints; the server description is current. | Refresh the production plugin connection in ChatGPT and Claude; inspect tool list. |
| 3 | The MCP privacy section is live at `https://meadtools.com/privacy-policy.html#mcp` with its revision date set to the deployment date. | Open signed out; confirm the section and date. |
| 4 | The OpenAI reviewer account exists in production (Section 2) and is populated. | Sign in fresh at `https://meadtools.com`; confirm the fictional brew and recipe appear. |
| 5 | The installed ChatGPT plugin is the **production** MeadTools plugin (not "MeadTools Local Dev"), connected as the reviewer account with account-read permission. | ChatGPT Plugins page; MeadTools connection settings. Disconnect and reconnect if it is signed in as any other account. |
| 6 | No personal MeadTools data is reachable from the connected account. | The reviewer account owns only the fixture records. |
| 7 | Any agent-operated run has explicit approval naming the model, about nine turns and the expected spend. | Chat approval before the first prompt. |

## 2. Production reviewer account (after November 9 activation)

Create one account per store so reviewers never share state. Both use a normal
email/password sign-in on a mailbox Larry controls (not a reserved `.test`
domain), no administrator role, no Google link, no MFA, codes or magic links.

1. Register through the normal sign-up page. Store the password only in
   Larry's password manager and the stores' private reviewer fields.
2. Grant complimentary premium through the existing manual entitlement
   (`premium_memberships.source = "manual"`) with a `paid_through` date at least
   three months past the planned submission, so reviewer access does not lapse
   during review. There is no admin UI; Larry applies manual grants with SQL
   against production (confirmed November 7). Review the statement before
   running it, run it once per reviewer account, and record who ran it, when and
   the expiry (no credentials). Template, with the email and date filled in:

   ```sql
   BEGIN;
   INSERT INTO premium_memberships (user_id, source, paid_through)
   SELECT id, 'manual', TIMESTAMPTZ '2027-04-30 23:59:59+00'
   FROM users
   WHERE email = '<reviewer email>' AND role = 'user' AND active = true
   ON CONFLICT (user_id, source)
   DO UPDATE SET paid_through = EXCLUDED.paid_through, revoked_at = NULL;
   -- Expect exactly 1 row; ROLLBACK otherwise.
   COMMIT;
   ```

   The unique `(user_id, source)` constraint makes it safe to rerun for an
   extension. Do not use the local seed script, which refuses non-local
   databases, and do not use a payment to obtain access.
3. Sign in as that account and create, through the normal UI:
   - Private recipe **Marketplace Review Traditional — synthetic recipe**: 1 US
     gal, traditional honey, target OG 1.100, fermentation FG 0.998, Lalvin 71B,
     TOSNA ×4 with Go-Ferm, no stabilizers.
   - Private brew **Marketplace Review Traditional** from that recipe, stage
     Primary, start date September 12, 2026.
   - Note: "Synthetic review fixture. Not a real fermentation or process
     recommendation."
   - Gravity entry: OG **1.100**, measured, September 12, 2026.
   - Gravity entry: fermentation FG **1.000**, measured, October 10, 2026.
   - No sensor devices, logs, purchases or shared/public records.
4. Connect the production plugin in ChatGPT as this account, choose account-read
   permission, and confirm one owned read returns the brew.
5. Record in the tracker (without credentials): account creation date, the
   entitlement expiry and that the fixture matches this section.

The local equivalent is `npm run db:seed:mcp-owned-demo` (see
[local fixtures](mcp-public-local-fixtures.md) and the local runbook). It is for
rehearsal only.

## 3. Capture setup

- Use the ChatGPT web app in a browser window about 1350 × 1000 px. Turn on Do
  Not Disturb and close unrelated tabs, windows and notifications.
- Start a **new chat**, collapse the sidebar (hides recent chats and the account
  name), and wait until the home-screen greeting is replaced by the first prompt
  before relying on the frame being free of personal text.
- Record the visible model selector and thinking-effort setting. If ChatGPT
  does not display a model name, write that down rather than guessing.
- macOS `Shift–Command–5` → **Record Selected Portion** → drag over the ChatGPT
  page only → Options: **Save to Desktop**, **Microphone: None**, no cursor
  highlighting needed → **Record**.
- **Start recording before typing the first prompt.** In the rehearsal the
  recorder started after prompt 1 was sent, so its typing was not captured.
- Optional: show a 5-second title card or say the opening line:
  "MeadTools provides brewing calculations, unsaved recipe drafts, catalog and
  wiki lookup, and explicitly authorized read-only access to owned brewing
  records. This walkthrough uses the production plugin and a reviewer account
  with fictional data."

## 4. Per-prompt routine

For every segment:

1. Click **+** in the composer and choose the production **MeadTools** plugin so
   its chip appears before the text. Do this for every prompt; it keeps
   ChatGPT from answering without the plugin or using another connection.
2. Type the exact prompt below and press Return.
3. Wait for the stop button to return to the send button.
4. Expand **Worked for …** so the tool activity line is visible.
5. Dismiss any feedback banner.
6. Scroll through the whole answer slowly (about 4 lines per step, 3–4 seconds
   per step) so each table and link is readable in the video.
7. Do not click returned links during the recording unless the step says so.

## 5. Segments, prompts and pass criteria

Timings are rehearsal observations, not limits.

| # | Prompt (exact) | Expected tool activity | Must be visible | Must not happen | Rehearsal |
| --- | --- | --- | --- | --- | --- |
| 1 | Find Lalvin 71B in the yeast catalog and show its nitrogen requirement and temperature range. | Catalog search (1 call) | Lalvin 71B identity; returned nitrogen requirement; temperature range with units | Values not from the tool | ~20 s; Low, 59–86 °F (15–30 °C) |
| 2 | Estimate ABV from original gravity 1.100 and fermentation final gravity 1.000. Just show the estimate and its basis. | ABV calculation (1 call) | ~13.26% labeled as an estimate; OG/FG basis | Calling it a measured or lab result | ~20 s; 13.26% |
| 3 | Find MeadTools wiki guidance about stabilizing mead and link me to the source. I do not need a dose calculation. | Wiki search + page fetch (2 calls) | Summary of fetched guidance; canonical wiki link | Unsolicited dose; claiming a page was read when the fetch failed | ~25 s |
| 4 | Draft a 1 US gallon traditional honey mead targeting OG 1.100 and fermentation FG 0.996. Adjust the honey amount. Use Lalvin 71B, TOSNA in four additions with Go-Ferm, and no stabilizers. Show the calculated draft and a link to review it in MeadTools; do not save it. | Yeast lookup, draft build, optional wiki guidance (~6 calls) | "Unsaved draft"; OG/FG targets; honey amount; Go-Ferm and TOSNA; returned builder link | Saving; claiming persistence; shortened/rebuilt link | ~45 s; honey 2.846 lb |
| 5 | Find my brew named Marketplace Review Traditional and show the recorded original and fermentation final gravity with their dates and a link to the brew. I am only asking for the records, not whether it is ready to bottle. | List brews, brew details, timeline (3 calls) | OG 1.100 (Sep 12, 2026); FG 1.000 (Oct 10, 2026); brew link; recipe target kept separate | Readiness/stability claim; another account's data | ~20 s |
| 6 | Save a new recipe called Marketplace Review Saved to my MeadTools account now. Do not just give me a draft. | None | States it cannot save; nothing saved | Claiming a save; using a draft or read to imply persistence | ~18 s |
| 7 | Order a 5-pound jar of honey and two packets of Lalvin 71B for me and charge my saved payment method. | None | Cannot purchase or charge; no order placed | Checkout, card collection, fabricated order | ~18 s |
| 8 | Set the fermentation chamber for my latest brew to 68 degrees Fahrenheit now. | At most a read of brews | Cannot control hardware; setting unchanged | Presenting a read as a change | ~20 s |

Accept a segment when every "must be visible" item appears and nothing in
"must not happen" occurs. If a segment fails, stop, note the exact output, and
re-record that segment in a fresh chat after the cause is understood; never edit
or splice a result to look like a pass. Expected total length is 8–10 minutes.

#509's public community tools ship in December, but leave them out of the
recording: production public results are other users' records, and the manifest
cases do not need them. Exercise them in the production tool checks instead.
Never use the local synthetic public fixtures in a production recording.

## 6. Stop, verify and host

1. Stop the recording from the menu bar. Find it with `ls -t ~/Desktop/*.mov`
   (the newest by name date; Finder sort can mislead).
2. Verify locally:
   - `ffprobe` duration and resolution; audio silent if no narration
     (`ffmpeg -af volumedetect`).
   - Extract frames every 15 s and a full-resolution frame from each segment;
     confirm every prompt, tool line, answer and link is legible.
   - Confirm no credentials, consent screens with private details, other chats,
     personal records, notifications or unrelated tabs appear.
3. Optionally trim dead time at the start/end only (QuickTime → Edit → Trim).
   Do not cut inside a segment.
4. Host at a reviewer-accessible URL Larry controls (for example an unlisted
   video or a public file link). Open it in a signed-out private window and play
   it through.
5. Put that URL in `extensions.com.openai.review.demo_recording_url` in
   `integrations/chatgpt/meadtools/plugin.json`, rebuild the review ZIP with the
   packaging script, and record the URL, date and production SHA in the tracker.

## 7. Local rehearsal record — November 7, 2026

Rehearsed through the private OpenAI tunnel with **MeadTools Local Dev** and the
synthetic local account `mcp-owned-review-demo@meadtools.test`. All eight cases
and a supplemental public-discovery segment passed; see the case table in the
submission materials. The private file is
`~/Desktop/Screen Recording 2026-11-07 at 10.26.56.mov` (8 min 54 s, 1354 × 1002,
silent). It shows local-only links and the Local Dev name and must not be
submitted. Lessons applied above: start recording first, attach the plugin to
every prompt, expand tool activity, dismiss feedback banners, scroll slowly and
expect `?utm_source=chatgpt.com` on returned links.

Local owned-read fixture: run
`ALLOW_MCP_OWNED_DEMO_FIXTURE=true npm run db:seed:mcp-owned-demo --workspace @meadtools/web`.
It is additive and repeatable, refuses non-loopback databases and names other
than `meadtools_dev`/`meadtools_test`, and touches no other account. It creates
the non-admin **Synthetic MCP review demo** account with a local manual premium
grant, the private synthetic recipe and brew described in Section 2, and no
sensor history. Its password is generated once into the private file
`~/.local/share/meadtools-mcp/owned-demo-account.local` and never printed. The
command verifies `list_brews`, `get_brew` and `get_brew_timeline` through the
shared account-read adapter.

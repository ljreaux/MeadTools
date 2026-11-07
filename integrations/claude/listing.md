# MeadTools — Claude connector submission draft

This is a preparation worksheet for the Claude developer portal, not an
installable plugin manifest or proof of directory approval. All countries
supported by the store; individual publisher intent: Larry Reaux. Confirm the
portal's publisher/account fields against the verified submission account.

Separately, `integrations/claude/meadtools/` now contains the source for an
installable plugin ZIP. `npm run mcp:package --workspace @meadtools/web` generates that archive with its
required hidden manifest and MCP configuration. The earlier preparation ZIP is
still a worksheet/asset kit, not the installable download. Compare the direct ZIP,
repository marketplace and directory paths in `docs/mcp-plugin-distribution.md`.

## Listing fields

- **Name:** MeadTools
- **One-liner:** Develop mead recipes, calculate brewing quantities, and read your brewing records.
- **Production MCP URL:** https://meadtools.com/mcp
- **Authentication:** OAuth 2.0 with automatic dynamic client registration
- **Documentation:** https://meadtools.com/integrations/mcp
- **Privacy:** https://meadtools.com/privacy-policy.html
- **Support:** https://meadtools.com/contact
- **Terms:** https://meadtools.com/terms-of-service.html
- **Icon:** use `logo.png` from the companion preparation ZIP; it is an exact
  resized/padded export of the existing MeadTools logo.
- **Prerequisites:** an existing MeadTools account with active premium access.
  The connector has no subscription sale, upgrade prompt, checkout or purchase
  tool. External AI-provider charges are separate from MeadTools chat credits.
- **Permissions:** basic tools by default; owned records require explicit
  account-read consent. All tools are read-only; drafts are unsaved.
- **Category:** Education (proposed; actual portal option verified November 7).
- **Slug:** meadtools (proposed; availability unchecked and permanent after submission).
- **Author name/URL:** Larry Reaux; https://meadtools.com
- **Ongoing maintenance contact:** Larry Reaux, contact@meadtools.com (confirmed).
- **Icon handling:** the portal recommends using the server favicon. A custom
  icon URL is optional; the prepared square PNG is available if needed.
- **Company/contact and policy acknowledgments:** confirm in the actual portal.
  Do not infer business verification from this individual-publisher draft or
  check legal attestations automatically.

November 7 access check: Larry signed into the publishing portal. Its connector
and listing forms were inspected read-only; no connector was selected or field
filled, and the dashboard still showed 0 submissions afterward.

## Description

MeadTools helps meadmakers draft recipes, calculate gravity targets and other
brewing quantities, look up ingredients, additives and yeast, and retrieve
brewing guidance from the MeadTools wiki, and search recipes and brew logs
that MeadTools members have chosen to share publicly. With explicit permission, the
connection can also read your owned recipes, brews, timelines and sensor
summaries. Calculated estimates are kept separate from recorded readings.
Recipe drafts remain unsaved until you review and save them in MeadTools.
The connection cannot save recipes, change brews, control devices or make
purchases. Sign in with your existing eligible MeadTools account.

## Review preparation

Use the accompanying `review-materials.md` for the walkthrough and fictional
reviewer data setup. `review-cases.json` contains the five positive and three
negative draft cases from the ChatGPT package; it is a worksheet, not a Claude
portal import format. Claude verification must also exercise every tool in the
final authorized inventory. Keep credentials only in private reviewer fields.

The policy source has an MCP-specific addition prepared for review; it is not
yet deployed. Final production sign-in and permission presentation, individual
tool invocation, revocation/reconnect, identity/domain checks and any requested
portal scans remain pending. Store-specific feedback may require changes.

This tools-only remote connector is submitted through
https://claude.ai/directory/manage; Claude does not require this preparation
ZIP to be uploaded. No interactive MCP App UI or screenshot carousel is included.

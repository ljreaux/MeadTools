# ChatGPT submission candidate

`meadtools/` is draft Agent Plugins 1.0 source for issue #475. It has not been
uploaded or approved. It references the existing production MCP endpoint and
does not deploy application code. Larry confirmed December 2026 deployment and
marketplace submission after that release and production verification; see
[marketplace readiness](../../docs/mcp-marketplace-readiness.md).

Publisher: Larry Reaux, individual (confirmed November 7). Larry completed OpenAI
verification and the organization's settings visibly show Verified. The publishing
portal is accessible; final project/residency selection, domain verification and
draft-specific checks remain pending. Larry selected all store-supported
countries; `publication.countries: []` explicitly removes package country
restrictions. This does not override a store's regional availability or policies.
Optional dark icons/colors are not required; no separate variants are selected.

The listing deliberately describes the established tool surface, without
depending on #509's public community discovery. The live tool scan will import
the actual deployed inventory; freeze and verify the production candidate before
review. Existing paid-account access is a prerequisite, not an in-plugin sale.
The MCP tools neither start checkout nor offer purchases. Larry confirmed
existing-account access only, without subscription sales, upgrade prompts or
checkout in the chatbot; the draft declares `commerce: false` with this explanation.

## Incomplete items

- A recorded, reviewer-accessible walkthrough URL. The script is in
  [submission materials](../../docs/mcp-marketplace-submission-materials.md).
- Deployment of the owner-approved additive MCP wording in
  [`privacy-policy.html`](../../apps/web/public/privacy-policy.html#mcp).
  It describes the current absence of an automatic deletion schedule; it does
  not invent a retention deadline. Larry approved it November 7; set the notice's
  revision date to its actual publication date during release review.
- Verified publisher setup and inspection of imported country/commerce settings.
- Dedicated post-launch reviewer account, sample data, production client case
  runs, domain verification and portal scans. Credentials belong only in secure
  portal fields and must never enter this directory or an archive.

All eight manifest cases are **Not run in the submitted client/version**.
Deterministic calculator and draft execution checks are separate evidence.
Do not call this source or an archive built from it submission-ready.

## Completed assets and downloadable drafts

The 512 × 512 `assets/logo.png` and 128 × 128 `assets/composer-icon.png` are
transparent PNG exports from `apps/web/public/assets/logoOnly.png`, made with
standard resizing/padding at Larry's explicit request. The original artwork is
unchanged apart from uniform resampling; the square canvas uses 82% width for
the mark. Both are well below 5 MiB. Light/dark backgrounds and a 48px composer
example were visually inspected. No generated redesign or Expo placeholder is
included. Separate dark assets remain optional and are not selected.

From the repository root, run:

```sh
npm run mcp:package --workspace @meadtools/web
```

Output goes to the ignored `release-drafts/mcp-marketplaces/` directory:

- `meadtools-chatgpt-0.1.0-draft.zip`: the upload-shaped package with only
  `plugin.json`, `mcp.json`, and the two referenced icon files at the proper paths.
- `meadtools-claude-preparation-draft.zip`: listing worksheet, original-brand
  icon, review materials and draft cases. This is a convenient preparation kit,
  not a file Claude requires for its remote-connector submission.
- `inventory.json`: archive entry lists, sizes, SHA-256 checksums and known gaps.

The builder also prepares customer preview downloads named
`meadtools-chatgpt-0.1.0.zip` and `meadtools-claude-0.1.0.zip`, copies them to
`apps/web/public/downloads/mcp/`, and the existing setup guide links to them.
The ChatGPT customer copy omits store review/publication materials; its upload
flow remains permission-dependent. Larry confirmed November 7 that both plugin
installs, sign-in, tool discovery and invocation work. Exact builds/package
hashes were not supplied. The Claude copy is a real
plugin archive, distinct from the earlier reviewer preparation kit. Its extracted
contents pass Anthropic's local validator. Installation and OAuth/tool invocation
are separate checks; public-submission portal validation remains pending.
See [distribution options](../../docs/mcp-plugin-distribution.md).

The builder validates image dimensions/type/size and listing/case limits, uses
explicit file inventories, builds fresh archives, checks ZIP integrity and
reopens the saved manifest to verify its exact content. It does not claim portal
acceptance, record a demo, call a provider or include reviewer credentials.
Archive entry times, permissions and ZIP timezone are normalized so rebuilding
unchanged source produces identical bytes. `npm run test:mcp-packages --workspace @meadtools/web` verifies
this across two timezones and checks the distinct install formats. Tests use
temporary output folders with `--no-public`, leaving public downloads untouched.

## Package validation — November 7

The manifest passes the published Agent Plugins 1.0 JSON Schema; its listing
lengths and five/three review-case counts pass local inspection. The portable
MCP schema rejects the per-server `extensions` key, even though the current
[OpenAI package guide](https://developers.openai.com/plugins/build/plugins#configure-mcp-authentication)
documents OAuth configuration at that exact location. The portable transport/URL
configuration passes when that vendor extension is excluded from the schema
check. The full authored `mcp.json` is **not** claimed to pass that schema.
Preserve explicit documented DCR settings; verify acceptance and imported OAuth
behavior with the actual portal validator before final packaging/submission.
Do not silently drop auth configuration to manufacture a passing schema result.

## Consent and OAuth

Use automatic dynamic client registration and metadata discovery. No client
secret, account credentials or personal bearer token belongs in `mcp.json`.
Explicit scopes are omitted so discovery can advertise both `mcp:tools` and
`mcp:account:read`. The normal MeadTools consent page defaults to basic tools;
owned reads require the user's explicit opt-in. Verify that the portal's saved
connection requests both capabilities and that declining optional account reads
still yields the basic inventory. Do not put the account-read scope into a
mandatory base-scope list just to make the fifth review case work.

Before final packaging, run the applicable official schema/package validation,
verify listing lengths, all four policy/support links, icon files, five positive
and three negative cases, recording URL, publication settings and inventory.
Build a ZIP from the contents of `meadtools/` with `plugin.json` at the archive
root. Keep this README, private credentials, `.app.json`, environment files,
dependency folders and generated portal bindings out of the authored upload.
Inspect the archive itself. Upload, submit, and publish are separate later steps.

# MeadTools plugin distribution options

Checked November 7, 2026. These options distribute connection configuration;
every user still signs in with their own MeadTools account and permissions.
They do not bypass premium, OAuth consent, store or organization restrictions.
No directory listing, repository marketplace or upload has been published.

Larry confirmed that preparation continues now, these changes target the
December 2026 release, and marketplace submissions follow that deployment and
production verification. No November 9 release inclusion is planned.

## Claude: ZIP, our own marketplace, or Anthropic Directory

Claude supports plugin ZIP upload in its regular web/desktop chat interface.
The package has `.claude-plugin/plugin.json` and a root `.mcp.json` pointing to
our HTTPS service; it runs no local server and contains no hooks or executables.
Its remote connector appears in the plugin's Connectors tab, where the user adds
or connects it and completes OAuth. Team/Enterprise organization policy can
require an Owner to add the connector first.

The install ZIP is separate from the earlier listing/reviewer preparation kit.
`integrations/claude/meadtools/mcp.json` is packaged as `.mcp.json`; this keeps
the configuration source visible despite the repository's ignore rule.

| Route | Steps for a user | Maintenance / tradeoff |
| --- | --- | --- |
| Plugin ZIP | Download → Customize → Plugins → Add → Upload plugin → connect MeadTools | Fast to distribute without a directory listing. Users must trust the download and import newer package versions themselves. |
| Our Git-backed marketplace | Add marketplace repository in Customize → Plugins → Add → Add marketplace → select/install MeadTools → connect | One extra initial source-registration step. Central repository distribution helps ongoing updates; availability still depends on account/org policy. We own the catalog and release/version maintenance. |
| Anthropic Directory | Find/open listed item → add/connect → sign in | Best general discovery and fewer source-setup steps. Requires submission/review and accurate maintained listing materials. |
| Existing custom connector | Enter production server URL → connect/sign in | Remains the supported baseline while the ZIP import path is verified. |

For one plugin, the directory is the simplest general-user destination after
approval. A direct ZIP is a useful interim/advanced alternative. A private
catalog is most useful for a continuing beta group or several plugins, rather
than as a way to reduce first-time installation steps. These usability judgments
are inferences from the documented flows, not measured conversion results.

“Hosting our own marketplace” can mean a Git repository with a small
`.claude-plugin/marketplace.json` catalog and the plugin folder under `plugins/`.
It does not require another application server or another MCP endpoint. A public
repository marketplace that individuals add is distinct from an organization's
private synced marketplace. Do not provision a repository, configure org access
or publish a marketplace based only on this comparison.

## ChatGPT: permission-dependent upload

OpenAI documents manual ZIP upload on ChatGPT web for accounts with upload
permission, including eligible workspace owners/admins. It is not established as
a universal personal-user import route. The guide offers an optional preview
download with that limitation; users without upload controls should use the
existing custom MCP instructions or a verified public listing once available.
Workspace sharing/import is not public directory publication.

The customer ZIP uses the same identity, production endpoint and DCR OAuth
configuration as the submission candidate, with store-review and publication
metadata omitted. It contains no private app binding, reviewer data or secret.
OpenAI's documented OAuth extension remains incompatible with its published
portable schema; do not claim the target importer accepts it before testing.

November 7 user follow-up: Larry confirmed that both plugin installs, sign-in,
tool discovery and invocation work. Record these as user-confirmed successes on
his accounts; do not request another full MCP test without a relevant change.
Exact package hashes and client builds were not supplied. This does not establish that
the OpenAI public-submission portal accepts the documented OAuth extension, or
that ZIP upload is available to every account.

## Build and check downloads

Run `npm run mcp:package --workspace @meadtools/web` at the repository root after changing package source.
It builds all draft/review archives in ignored `release-drafts/mcp-marketplaces/`
and copies just the two customer ZIPs into `apps/web/public/downloads/mcp/`:

- `/downloads/mcp/meadtools-claude-0.1.0.zip`
- `/downloads/mcp/meadtools-chatgpt-0.1.0.zip`

The public ZIPs are committed static assets when the change is committed; no
runtime archive generation, new API route, signing key or shared user account
is introduced. Versioned URLs avoid changing an installed package silently.
Raise versions and update guide links for a new package release.

The Claude archive was extracted and validated with `claude plugin validate`,
which parses package structure/configuration without invoking a model. That
does not prove a web/desktop import, OAuth connection or client tool discovery.
Both download sections remain labeled preview while December deployment and
store requirements are finalized. The user-confirmed install/OAuth/tool results
above supersede the earlier unverified client-flow status. Existing MCP
execution tests are not a reason to rerun the entire tool suite for this
packaging-only path.

Local guide verification: both ZIP URLs returned 200 with ZIP bytes; the Claude
download link completed a browser download. Both host tabs and their optional
ZIP disclosures worked through keyboard activation. At a 390px viewport, the
document and download control fit without horizontal overflow. Web typecheck,
targeted lint and all three i18n tests passed. The temporary UI-only preview was
stopped after verification; no tunnel, client connection or account permission
was created, and no model/provider call was made.

## Official references

- [Claude plugin installation](https://claude.com/docs/plugins/overview)
- [Claude package structure and testing](https://claude.com/docs/plugins/build)
- [Repository marketplace format](https://code.claude.com/docs/en/plugins/create-marketplace)
- [ChatGPT ZIP upload permissions and flow](https://help.openai.com/en/articles/20001256-plugins-in-chatgpt)

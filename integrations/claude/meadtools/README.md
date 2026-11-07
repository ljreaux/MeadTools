# MeadTools for Claude

Connect Claude to MeadTools for read-only recipe drafting, brewing calculations,
catalog and wiki lookup, public community recipe and brew discovery, and optional
owned recipe and brew reads. Drafts remain
unsaved. This plugin does not write records, control devices, make purchases,
start checkout or sell subscriptions. It connects to the production MeadTools
service, not a local development server. Use your own existing MeadTools account
with active premium access. Your Claude plan and organization policies must also
allow plugin uploads and the connector.

## Install the ZIP

1. Download the MeadTools Claude plugin ZIP; keep it zipped.
2. In Claude web or desktop, open Customize → Plugins → Add → Upload plugin.
3. Select the ZIP, then open the installed plugin's Connectors tab.
4. Add or connect MeadTools and finish the normal MeadTools OAuth sign-in and
   consent flow. Choose automatic client registration when offered.
5. Basic tools are the default. Enable private account reads only if you want
   Claude to receive your owned recipe/brew details, notes and sensor history.
6. In a conversation, ask: “Use MeadTools to find Lalvin 71B and show its nitrogen
   requirement.” Review the actual returned catalog result.

On Team and Enterprise plans, an Owner may need to add the connector for the
organization before members can sign in individually. Plugin installation does
not bypass those controls or grant premium access. The package contains no
password, token, local server, executable, hook or pre-approved tool permission.

If upload is unavailable, follow the normal custom-connector instructions on
https://meadtools.com/integrations/mcp using https://meadtools.com/mcp.
Revoke access from that page. Reconnect to change the allowed permissions.
For updates to a manually uploaded copy, download/import the new version rather
than assuming it receives repository marketplace updates.

## Package status

This is a preview installation package. Its archive structure/configuration can
be checked locally; import, production sign-in and tool discovery still need a
target-client check. It is not an Anthropic Directory approval or listing.

The source configuration is named `mcp.json` in the MeadTools repository because
the repository ignores `.mcp.json`. Packaging writes it to `.mcp.json` at the ZIP
root, alongside `.claude-plugin/plugin.json`; end users do not rename anything.

Documentation: https://meadtools.com/integrations/mcp

Privacy: https://meadtools.com/privacy-policy.html

Support: https://meadtools.com/contact

Terms: https://meadtools.com/terms-of-service.html

Source license: MIT, included in LICENSE. The MeadTools name/logo identify the
service; no new license or permission for branding is declared here.

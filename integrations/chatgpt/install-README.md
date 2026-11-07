# MeadTools for ChatGPT — preview manual-upload package

This ZIP connects to the existing production MeadTools MCP server using OAuth.
It contains no credentials and deploys no server. It requires your own eligible
MeadTools account with active premium access; it cannot sell subscriptions,
promote upgrades, start checkout or grant access on its own.

## Check whether your account supports ZIP uploads

OpenAI documents ZIP uploads on ChatGPT web for accounts with upload permission,
including eligible workspace owners/admins. This is not a universal installation
route for every personal ChatGPT account. If your account has no upload control,
use the custom MCP setup instructions at https://meadtools.com/integrations/mcp,
or the verified public directory listing once one exists.

Where the control is available, OpenAI's documented admin flow is:

1. Open Admin console and select the intended workspace.
2. Open Plugins → Add → Upload plugin, then select this ZIP.
3. Complete any required MCP connection setup and your own normal MeadTools
   OAuth sign-in/consent. Do not paste a shared password, personal bearer token
   or fabricated OAuth client secret into the package.
4. Install the resulting plugin if uploading only created an available item.
   Start a fresh chat and ask MeadTools to look up Lalvin 71B.

Only opt into account-read permission if you want the connected service to
receive owned recipes/brews, including private records. Revoke access on the
MeadTools MCP setup page. Installation does not bypass workspace restrictions.

This is a preview manual-upload candidate, not a directory-approved plugin.
The actual ChatGPT import flow and tool discovery remain unverified. The portable
schema currently rejects the OpenAI OAuth extension documented in OpenAI's own
package guide; the file is preserved for target-portal validation. The separate
store-review ZIP contains reviewer cases and publication metadata; this customer
download omits those review materials.

Official upload instructions:
https://help.openai.com/en/articles/20001256-plugins-in-chatgpt

Privacy: https://meadtools.com/privacy-policy.html

Support: https://meadtools.com/contact

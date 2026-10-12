# MCP client compatibility plan (issue #438)

This is a **Preview-only** manual test plan for PR #447. The stable PR branch
URL, followed later by `preview.meadtools.com`, is the MCP endpoint under test.
Premium sales and production MCP access remain off. Passing a protocol fixture
does not establish that a particular AI client can finish OAuth or invoke a
tool.

## Client shortlist

Status means an observed MeadTools result, not a vendor's general MCP claim.
Use a separate named MeadTools connection for each client so revocation is
unambiguous. Do not use an API model test or automated evaluation without
explicit approval for the provider spend, model, and expected number of turns.

Prioritize **recipe use**, not the number of clients that can technically speak
MCP. The seven tools search ingredients, additives, yeast, and wiki content or
calculate and draft recipes. They fit general chat and research conversations.
Coding assistants are useful for a protocol smoke test or a developer building
a MeadTools integration, but are not a launch requirement or a reason to add
provider-specific setup pages. This is a product-fit judgment; actual user
demand may change the order.

| Priority | Client | First authentication path | Access or compatibility note | MeadTools status |
| --- | --- | --- | --- | --- |
| Baseline | ChatGPT custom app | OAuth custom MCP app | Existing first-release target. Codex desktop availability is a separate check. | Connected, tool use, revocation, and reauthorization observed on PR Preview. |
| Baseline | Claude Desktop / web | OAuth custom connector | Existing first-release target. | Connected, tool use, revocation, and reauthorization observed on PR Preview. |
| Next chat test | [Grok web custom connector](https://docs.x.ai/grok/connectors) | OAuth | `grok.com/connectors` accepts a public custom MCP URL. | User reports it works on PR Preview; tool trace, revocation, and reconnection still need recording. |
| UI unavailable | [Gemini web custom app](https://support.google.com/gemini/answer/17209137) | OAuth dynamic client registration | Google lists US, age 18+, personal account, Keep Activity on, and English requirements. Its guide does not state a paid-plan requirement. Look under Gemini web Settings → Connected Apps (possibly under Personal Intelligence) → Custom apps. | User cannot find the Custom apps control; account eligibility or rollout is unresolved. |
| Paid plan required | [Perplexity custom remote connector](https://www.perplexity.ai/help-center/en/articles/13915507-adding-custom-remote-connectors) | Try OAuth; fall back to personal token if offered | Perplexity says custom remote connectors require Pro, Max, or Enterprise. On an eligible account: Account settings → Connectors → + Custom connector → Remote. Watch for the [reported public-client registration error](https://community.perplexity.ai/t/custom-mcp-connector-fails-with-did-not-return-a-client-secret-for-rfc-7591-compliant-public-client-registrations/5172); do not add a fake OAuth client secret to MeadTools. | User cannot find the Custom connector control; account plan is unconfirmed. |
| Opportunistic chat test | [Mistral Work custom connector](https://docs.mistral.ai/vibe/work/connectors/mcp-connectors) | OAuth dynamic client registration | Potential general-chat use, but requires an organization administrator. | Not tested. |
| Developer smoke test | Antigravity CLI | Personal token through local stdio bridge | Direct remote Authorization headers failed in the tested CLI; the bridge worked. OAuth remains untested. | `search_ingredients` invoked successfully with a token. |
| Developer smoke test | [VS Code with GitHub Copilot Chat](https://code.visualstudio.com/api/extension-guides/ai/mcp) | OAuth dynamic client registration | VS Code documents DCR and loopback / `vscode.dev` callbacks. Test only if readily available; recipe use is secondary. | Not tested. |
| Defer | [Grok Build CLI](https://docs.x.ai/build/features/mcp-servers), [Cursor](https://cursor.com/docs/sdk/typescript), [Replit Agent](https://docs.replit.com/features/mcp/overview) | OAuth or personal token | Coding-oriented clients. Revisit for user demand or a concrete integration workflow. | Not tested. |
| Defer | [Microsoft 365 Copilot custom connector](https://learn.microsoft.com/microsoft-365/copilot/connectors/set-up-custom-federated-connectors) | Organizational OAuth/SSO setup | Tenant administration and a connector package make this a poor early test. | Not tested. |

Poe, DeepSeek's consumer chat, and Meta AI are not scheduled until they publish
a first-party way for a user to add an arbitrary authenticated remote MCP
server. Self-hosted clients such as Open WebUI or LibreChat can be added after
the mainstream hosted-client matrix is stable.

## Preflight for each client tested

1. Deploy the OAuth and setup-page changes on the PR branch before attempting
   any new client's OAuth flow. Deployments built before this change have the
   original ChatGPT/Claude callback allowlist.
2. Open `/integrations/mcp` on that deployment as the premium test account and
   copy the displayed HTTPS `/mcp` URL. Check that the deployment is publicly
   reachable and `PREMIUM_MCP_ENABLED` is on only for the test environment.
3. Confirm the OAuth discovery URLs advertise that same origin. Reconnect any
   client configured against an earlier deployment URL; OAuth tokens are bound
   to the resource URL.
4. Start with OAuth when the client offers it. Check the exact callback URL on
   MeadTools' consent screen before approving. MeadTools accepts HTTPS and
   local loopback callbacks, requires S256 PKCE, and matches the registered
   callback exactly. A client requiring an app-specific callback scheme or a
   confidential client secret needs separate implementation review.
5. Use a personal token only if the client has a secure bearer-header path.
   Copy it once from the advanced section; never paste it into a prompt, issue,
   screenshot, shell history, or test report. Revoke disposable test tokens.

## Manual check for chat clients

Record pass, fail, or blocked for each item, with the client version and auth
method. Keep model use to one short prompt per client unless a failure needs a
specific retry. No automated model batches are part of this plan.

1. **Connect:** Add the Preview `/mcp` URL. Complete MeadTools sign-in and
   explicit consent, or use the personal-token path. Record the callback host
   or the first safe error code, without recording credentials.
2. **Discover:** Confirm the client lists MeadTools tools, ideally all seven:
   `search_ingredients`, `search_additives`, `search_yeasts`, `search_wiki`,
   `fetch_wiki_page`, `calculate_gravity_target`, and `build_recipe_draft`.
3. **Invoke:** Ask: “Use MeadTools `search_ingredients` to search for raspberry.
   Show the matches and name the tool you called.” Confirm the trace shows the
   MeadTools tool, not a web search or invented answer.
4. **Revoke:** Revoke that client's connection on `/integrations/mcp`, then
   repeat the prompt in a new conversation. It must lose MeadTools access.
5. **Reconnect:** Reauthorize or create a new personal token and repeat the
   ingredient search. The client must regain access without reviving the old
   connection.

For the first passing client in each distinct OAuth implementation, also let
the connection expire naturally and verify refresh. Test an expired premium
account and the MCP kill switch with the local fixture or one selected Preview
client; repeating those server-side denial cases for every provider adds no
client-specific coverage. Provider model usage is billed by that provider;
MeadTools MCP calls do not spend hosted-chat prompt credits. For an optional
developer client, one connect, discover, and invoke smoke test is enough to
establish basic compatibility; a full release-support claim still requires the
revocation and reconnection checks above.

## Reporting and release decision

For each client, record: date, client/version, Preview URL hostname (not a
token), auth mode, callback scheme/host, seven-tool discovery result, exact
tool invoked, revocation result, reconnection result, and a short sanitized
error if blocked. Mark a client **supported** in user-facing instructions only
after connect, invocation, revocation, and reconnection all pass. A client
whose OAuth fails but personal-token path passes should be documented as
token-supported, with the extra setup steps it actually requires.

Keep the existing ChatGPT and Claude guide tabs as confirmed paths. Grok's
connection has been reported working; record tool use, revocation, and
reconnection before publishing a Grok setup guide. Leave Gemini and
Perplexity as blocked until the account UI exposes custom connectors. Add
other provider-specific instructions only after their manual results are
observed. Publishing a connector in a vendor catalog or making a one-click
install link is separate follow-up work.

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

| Priority                | Client                                                                                                                                                                          | First authentication path                         | Access or compatibility note                                                                                                                                                                                                                                                                                                                                                                                                            | MeadTools status                                                                                                                                                                                    |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Baseline                | ChatGPT custom app                                                                                                                                                              | OAuth custom MCP app                              | Existing first-release target. Codex desktop availability is a separate check.                                                                                                                                                                                                                                                                                                                                                          | Connected, tool use, revocation, and reauthorization observed on PR Preview.                                                                                                                        |
| Baseline                | Claude Desktop / web                                                                                                                                                            | OAuth custom connector                            | Existing first-release target.                                                                                                                                                                                                                                                                                                                                                                                                          | Connected, tool use, revocation, and reauthorization observed on PR Preview.                                                                                                                        |
| Next chat test          | [Grok web custom connector](https://docs.x.ai/grok/connectors)                                                                                                                  | OAuth                                             | `grok.com/connectors` accepts a public custom MCP URL.                                                                                                                                                                                                                                                                                                                                                                                  | User reports it works on PR Preview; tool trace, revocation, and reconnection still need recording.                                                                                                 |
| Verified chat client    | [Gemini web custom app](https://support.google.com/gemini/answer/17209137)                                                                                                      | OAuth dynamic client registration                 | Google lists US, age 18+, personal account, Keep Activity on, and English requirements. Its guide does not state a paid-plan requirement.                                                                                                                                                                                                                                                                                               | On 2026-10-11, user completed OAuth and invoked `search_ingredients` on PR Preview. MeadTools revocation blocked access; disconnecting and reconnecting in Gemini Connected Apps restored tool use. |
| Paid plan required      | [Perplexity custom remote connector](https://www.perplexity.ai/help-center/en/articles/13915507-adding-custom-remote-connectors)                                                | Try OAuth; fall back to personal token if offered | Perplexity says custom remote connectors require Pro, Max, or Enterprise. On an eligible account: Account settings → Connectors → + Custom connector → Remote. Watch for the [reported public-client registration error](https://community.perplexity.ai/t/custom-mcp-connector-fails-with-did-not-return-a-client-secret-for-rfc-7591-compliant-public-client-registrations/5172); do not add a fake OAuth client secret to MeadTools. | User cannot find the Custom connector control; account plan is unconfirmed.                                                                                                                         |
| Opportunistic chat test | [Mistral Work custom connector](https://docs.mistral.ai/vibe/work/connectors/mcp-connectors)                                                                                    | OAuth dynamic client registration                 | Potential general-chat use, but requires an organization administrator.                                                                                                                                                                                                                                                                                                                                                                 | User reports it works on PR Preview; tool trace, revocation, and reconnection still need recording.                                                                                                 |
| Developer smoke test    | Antigravity CLI                                                                                                                                                                 | Personal token through local stdio bridge         | Direct remote Authorization headers failed in the tested CLI; the bridge worked. OAuth remains untested.                                                                                                                                                                                                                                                                                                                                | `search_ingredients` invoked successfully with a token.                                                                                                                                             |
| Developer smoke test    | [VS Code with GitHub Copilot Chat](https://code.visualstudio.com/api/extension-guides/ai/mcp)                                                                                   | OAuth dynamic client registration                 | VS Code documents DCR and loopback / `vscode.dev` callbacks. Test only if readily available; recipe use is secondary.                                                                                                                                                                                                                                                                                                                   | Not tested.                                                                                                                                                                                         |
| Defer                   | [Grok Build CLI](https://docs.x.ai/build/features/mcp-servers), [Cursor](https://cursor.com/docs/sdk/typescript), [Replit Agent](https://docs.replit.com/features/mcp/overview) | OAuth or personal token                           | Coding-oriented clients. Revisit for user demand or a concrete integration workflow.                                                                                                                                                                                                                                                                                                                                                    | Not tested.                                                                                                                                                                                         |
| Defer                   | [Microsoft 365 Copilot custom connector](https://learn.microsoft.com/microsoft-365/copilot/connectors/set-up-custom-federated-connectors)                                       | Organizational OAuth/SSO setup                    | Tenant administration and a connector package make this a poor early test.                                                                                                                                                                                                                                                                                                                                                              | Not tested.                                                                                                                                                                                         |

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
reconnection before publishing a Grok setup guide. Gemini passed OAuth, tool
invocation, revocation, and reconnection on PR Preview. After MeadTools
revocation, Gemini required a manual disconnect and reconnect in Connected Apps;
its agent did not explain that recovery step. Perplexity still needs an eligible
paid account before testing. Add other
provider-specific instructions only after their manual results are observed.
Publishing a connector in a vendor catalog or making a one-click install link
is separate follow-up work.

## Gemini Spark registration investigation

Google's [custom app instructions](https://support.google.com/gemini/answer/17209137)
say the web app uses Dynamic Client Registration (DCR), with manual client
credentials as a fallback. MeadTools advertises a registration endpoint and
accepts public OAuth clients with HTTPS callbacks. A Preview DCR probe using
the callback URI copied from Gemini's form returned HTTP 201. The path-specific
protected-resource and authorization-server metadata endpoints also return
JSON on Preview. Gemini still shows its generic registration error. Those
checks rule out the tested callback and missing path-specific metadata; they
do **not** establish what Gemini actually sent or which response it rejected.

There is no documented Gemini Spark requirement for a client secret or MCP
Server Card. A Firecrawl user reported the
[same DCR fallback](https://github.com/firecrawl/firecrawl-mcp-server/issues/345),
then closed the issue after Gemini started working three days later without a
reported server change. A suggested Google redirect-domain allowlist was not
confirmed as the fix. Other operators have reported
[failures later in the OAuth flow](https://discuss.ai.google.dev/t/gemini-spark-custom-mcp-oauth-stops-after-302-callback-and-never-calls-token/177327).
These reports show the generic error can be transient or occur at different
steps; they do not identify MeadTools' cause. The
[MCP Server Card discovery extension](https://github.com/modelcontextprotocol/ext-server-card/blob/main/docs/discovery.md)
does not make a card mandatory for OAuth registration. Do not implement a
confidential-client path or speculative server-card response solely to satisfy
the generic Gemini error.

After the path-specific OAuth metadata deployed, Gemini requested
`/.well-known/mcp/server-card/mcp`. The existing Preview deployment answers
that request with HTTP 200 and an HTML page, which is invalid for a
machine-readable Server Card. A local change now returns a JSON Server Card at
that exact path and the extension's recommended `/mcp/server-card` path. It
uses the [experimental extension schema](https://github.com/modelcontextprotocol/ext-server-card),
so this is a compatibility trial, not evidence that Gemini requires a card.
The local response validates against the extension's JSON Schema.

The card deployed and returned JSON on Preview, but Gemini still showed the
same registration error. A more direct incompatibility emerged from a
[Gemini Spark integration report](https://discuss.ai.google.dev/t/gemini-app-spark-custom-apps-mcp-oauth-never-exchanges-the-code-cannot-complete-request-on-oauth-redirect-googleusercontent-com/186405):
Gemini submitted **six** redirect URIs and later used an OAuth `state` around
1,400 characters. MeadTools previously rejected more than five redirect URIs
and any state longer than 256 characters. The six-URI request returned HTTP
400 `invalid_client_metadata` on the previous Preview deployment and HTTP 201
after the bounded-limit fix deployed. The parser and long-state regression tests
pass. On 2026-10-11, the user retried the stable PR Preview branch URL,
completed MeadTools sign-in and consent, and received results from
`search_ingredients` in Gemini. MeadTools revocation then blocked access, and a
manual disconnect and reconnect in Gemini Connected Apps restored the tool.
The Gemini agent did not clearly explain the recovery step.

## Private account permission follow-up (#452)

Development checkpoint: **2026-10-14**. Local tests use dummy credentials,
mocked persistence and a real SDK in-memory protocol exchange; no model provider
or live client is called. Run:

```sh
node --import tsx --test apps/web/lib/mcp/*.test.ts
npm run test:recipe-agent
npm run test:api-contract
```

These cover scope validation/canonicalization, explicit personal-token opt-in,
OAuth consent selection (default basic, opt-in private, no expansion), code/token scope binding, single-use consent across different choices, refresh preservation/reduction and rejection
of escalation, legacy discovery, all five unauthorized direct tool calls,
HTTP insufficient-scope challenges, expired/revoked credentials, premium loss,
payment restrictions, inactive users, resource binding, and the kill switch.
Account tools are now registered behind the explicit account-read capability.
The separate deterministic account-read fixture covers successful execution of
all five tools, ownership predicates, pagination, response validation and
rate/concurrency admission. See [account-read contracts](mcp-account-reads.md).
These local checks do not establish live client compatibility.

Protocol/client sources checked on 2026-10-14:

- [MCP authorization specification](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization): resource-bound tokens, least privilege and HTTP 403 insufficient-scope challenges for step-up authorization. Metadata advertises both supported scopes; the initial 401 challenge omits a scope override so clients discover both. The consent page still defaults the granted access to basic tools only.
- [Claude remote connector guide](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp): publicly reachable HTTPS service, OAuth and automatically registered clients. Use Register automatically for this server's existing DCR support; published client identities are a separate compatibility capability.
- [OpenAI plugin quickstart](https://developers.openai.com/plugins/quickstart): custom remote MCP setup and OAuth installation. Documentation availability does not prove that a particular installed client can request or step up to the additional scope.

After #451 is integrated and a reviewed Preview deployment is available, record
actual date, client version (or web build if shown), and pass/fail with redacted
operational evidence for each client. Do not capture credentials or account
content in logs. Prior results above apply only to the seven public tools.

| Check                                                                                                                                                      | Claude          | ChatGPT         |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- | --------------- |
| Client version/date                                                                                                                                        | Pending         | Pending         |
| Existing connection: seven public tools; direct private call denied                                                                                        | Pending         | Pending         |
| New plugin without opening Advanced settings: both scopes discovered; basic tools selected by default; choose private reads or keep basic; deny also works | Pending         | Pending         |
| Client requests basic only: no private choice; forged opt-in denied                                                                                        | Pending         | Pending         |
| Token and refresh retain the consent selection even when client requested both scopes                                                                      | Pending         | Pending         |
| Discovery: seven tools for legacy; twelve for account-read grant                                                                                           | Pending Preview | Pending Preview |
| Owned brew detail and history; foreign/missing ID denied                                                                                                   | Pending Preview | Pending Preview |
| Owned saved recipe including private recipe; foreign ID denied                                                                                             | Pending Preview | Pending Preview |
| Pagination across multiple brew/recipe/history pages; bounded results                                                                                      | Pending Preview | Pending Preview |
| Request/argument/output limits; account rate and concurrency limits                                                                                        | Pending Preview | Pending Preview |
| Refresh preserves permissions; no silent legacy upgrade                                                                                                    | Pending         | Pending         |
| Revocation immediately denies; reconnect requires fresh explicit consent                                                                                   | Pending         | Pending         |
| Expiry, premium loss, payment restriction and kill switch deny                                                                                             | Pending         | Pending         |

Do not mark the private-read launch gate passed while any required row is
pending. Real-model batches require separate approval naming model and turns.

### Local user smoke-check checkpoint — 2026-10-14

The user confirmed the local custom-plugin connection, OAuth sign-in and
consent selection worked in Codex desktop through a Cloudflare HTTPS tunnel.
The installed client version was not recorded. Server-side checks also verified
that the public issuer and registration endpoint matched the tunnel origin,
dynamic registration returned HTTP 201, and the initial authentication challenge
allowed discovery of both supported scopes. The consent controls now use the
app's shadcn Radio Group component.

This is local development evidence, not a completed Preview compatibility
matrix. Record client versions and verify Claude/ChatGPT Preview behavior,
including successful account reads and pagination after #451, before rollout.

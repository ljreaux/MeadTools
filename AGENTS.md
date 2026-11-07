# MeadTools agent instructions

These rules apply to the whole repository. App directories add their own
`AGENTS.md` for framework- and app-specific guidance:

- [`apps/web/AGENTS.md`](apps/web/AGENTS.md) — Next.js web app, including the
  Next.js-managed docs block.
- [`apps/mobile/AGENTS.md`](apps/mobile/AGENTS.md) — Expo mobile app.

When an app file and this file disagree, the app file wins for work inside that
app. Each `CLAUDE.md` beside an `AGENTS.md` only imports it (`@AGENTS.md`); put
guidance in `AGENTS.md`, not `CLAUDE.md`. Personal, machine-only notes belong
in a Git-ignored `CLAUDE.local.md` or a local runbook, never in these tracked
files. (`AGENTS.override.md` is also ignored, but Codex reads it _instead of_
`AGENTS.md` in that directory, so avoid it unless it repeats these rules.)

Optional skills, plugins and MCP servers that help with this repository are
listed in [`docs/agent-tooling.md`](docs/agent-tooling.md). They are not
required: never assume one is installed.

## Git workflow

- Use the regular project checkout and the user's existing branch. Inspect the
  current branch and `git worktree list` before editing. Do not create or switch
  branches/worktrees unless the user explicitly requests it.
- Leave changes uncommitted for review. Do not commit or push after each slice;
  commit or push only when the user explicitly requests it.
- Open feature pull requests against `preview`, not `main`. `main` only
  receives the reviewed monthly release from `preview`; its release-note and
  `monthly-release-gate` checks do not apply to feature PRs. See
  `docs/monthly-release-gate.md`.
- Never add AI-tool attribution to this project's commits, pull requests or
  GitHub comments. Omit lines such as "Generated with Claude Code" (or any
  other agent/tool) and `Co-Authored-By` trailers naming an AI model, even if
  a tool or harness suggests adding them.

## Secrets and local configuration

- Never print, inspect, or expose values from `.env*` files, API keys, bearer
  tokens, cookies, or browser/session state. Use targeted checks that report
  only whether required configuration is present.
- Never commit credentials, tunnel IDs, private workspace details or other
  machine-specific configuration. Link to a local runbook instead of copying
  its contents.

## Existing UI patterns (web)

- Before building or changing UI, inspect the closest existing product flow and
  relevant shared components. Reuse the project's custom patterns wherever
  they fit; do not replace them with native controls or one-off equivalents.
- Examples in `apps/web/components/ui/` include `SearchableInput` for
  searchable choices, `amount-unit-field.tsx` for combined amount/unit fields,
  `input-group.tsx` (`InputGroup`) for search/actions, and the shared Select,
  Tabs, Dialog, AlertDialog and `LoadingButton` components. Prefer these over
  native selects, separate amount/unit inputs, hand-built tabs or custom
  confirmation dialogs.
- If a shared component needs a small capability, extend it compatibly or
  extract the existing pattern for reuse instead of duplicating it. Preserve
  existing behavior for other callers.
- Preserve useful navigation and the account header across related account
  pages, including signed-in integration setup. Keep navigation labeled and
  grouped as features grow instead of adding more icon-only shortcuts.
- Verify focus, keyboard use and mobile layout in the existing local preview.
  Opening a dialog must not automatically open a suggestion list merely
  because its searchable field receives initial focus.

## Translations

Git is the source of truth for translations. User-facing English strings live
in `packages/i18n/locales/en/`; German translations live in the matching
`de/` files. Feature PRs may change English strings. After an English change
reaches `preview`, Weblate generates a separate German commit that remains in
the needs-review state until a human reviews it.

Human German corrections must use a German-only PR to `preview`. Do not bulk
rewrite approved German translations. Follow `docs/translation-workflow.md`.

## Development servers

Use the user's existing development server or shared local preview for browser
work. Check the current browser/project context for the available preview before
starting another server; do not assume a particular chat app or development harness.
Do not stop or replace a server started by the user. Start a private development
server only when necessary and no suitable preview is available. State when one
is started, and stop it before ending the turn or explicitly remind the user
that it remains running.

## Manual testing and local data

- Manual browser/preview checks use the normal local development database and
  the existing local test accounts. Keep useful test records (for example the
  recipes, brews or uploads a check created) so Larry can inspect the results
  afterward, and say which records were created. Do not switch the preview to
  a disposable database solely for isolation.
- Disposable databases are only for destructive automated tests or scripts
  that explicitly require a guarded test database. Keep those runs separate
  from the normal local preview.
- Resetting the normal local database is destructive, even though it can be
  rebuilt. Its resettable setup does not authorize a reset: confirm the scope
  with the user first (see Database changes).

## Local MCP development

- Readiness of the local MCP runtime is not proof that a client completed
  OAuth or discovered tools. Report client verification separately, and
  refresh the client's connection after tool or schema changes.
- Preserve existing authentication, entitlement and account-read consent.
  Provider evaluations still require the approval described under Chatbot
  safety.
- Client compatibility status and manual test steps live in
  `docs/mcp-client-testing-plan.md`.

### Maintainer machine setup (Larry's Mac only)

This setup exists only on Larry's Mac; skip it elsewhere.

- For MCP development and ChatGPT client testing, reuse the existing OpenAI
  Secure MCP Tunnel setup. Read the local runbook at
  `~/.local/share/meadtools-mcp/README.md` first; the launcher and tunnel
  client live outside this repository.
- `meadtools-mcp-dev` (in `~/.local/bin/`) starts this regular checkout's web
  server on `http://localhost:3000` and the private tunnel together. Check for
  an existing server/tunnel before starting it; do not replace a user-started
  server. Ctrl+C stops both. State when they are started and whether they
  remain running at handoff.
- The connection is named **MeadTools Local Development**. Its persistent
  tunnel and ChatGPT workspace are recorded only in the local runbook. Reuse
  that tunnel rather than creating temporary Cloudflare tunnels, changing DNS,
  or provisioning another tunnel for routine MCP issues.
- Confirm `http://127.0.0.1:8788/readyz` returns 200 before asking Larry to
  connect ChatGPT. In ChatGPT, add a custom MCP connection using **Tunnel**
  and **OAuth**, then complete local MeadTools sign-in/consent. The tunnel
  must run during discovery and calls.
- The dedicated runtime key is in Git-ignored
  `apps/web/.env.mcp-tunnel.local`. Never inspect, print or commit its value,
  copy it into instructions, or share raw tunnel/server logs.

## Chatbot safety and architecture

- Before running an automated evaluation or batch against a real model
  provider, get explicit approval for the spend and state the model and
  expected number of turns. Do not turn ordinary local checks into real-model
  calls.
- MeadBot and MeadBotAPI are reference-only projects owned by someone else.
  Do not run their servers, inspect their credentials, or modify them unless
  the user explicitly asks.
- When fixing chatbot behavior observed in an evaluation, add a deterministic
  regression test for that failure before treating the fix as complete.
- Chatbot domain logic, schemas, workflows, and API contracts should be
  reusable across MeadTools applications. Keep app-specific UI, authentication,
  and persistence adapters at the application boundary; do not embed new
  product behavior solely in the web chat UI unless it truly cannot be shared.

## API contract changes

When adding or changing anything under `apps/web/app/api/` (including a new
route, request/response shape, status code, or OpenAPI annotation), update the
API contract and verification artifacts in the same change. Follow
`docs/domain/api-contract.md`: run `npm run contracts:generate`,
`npm run openapi:generate`, and `npm run test:api-contract`, then review the
generated contract/OpenAPI diffs alongside the implementation. Include them in
the same commit when the user requests a commit. Do not hand-edit generated
`packages/api-contract/src/contracts.ts` or
`packages/api-contract/src/zod/openapi-aliases.ts`.

## Database changes

- Every production schema change needs a reviewed Prisma migration under
  `apps/web/prisma/migrations/`. Vercel production builds apply those with
  `prisma migrate deploy`.
- If a migration needs modification and has not been pushed to GitHub, edit
  that existing migration in place rather than adding a follow-up migration to
  modify it. Check its Git history against freshly fetched GitHub remote refs;
  do not infer push status from the local development database or absence from
  the current branch's upstream alone. Preserve migrations already pushed to
  GitHub or applied to a shared database unless the user explicitly authorizes
  rewriting that history; normally add a new migration for those changes.
- The complete, viewable database ERD lives in `docs/database/`: open
  `erd.html` for the offline searchable/zoomable viewer, or the committed SVGs
  and `README.md` on GitHub. After adding, editing, renaming or removing any
  migration, or changing `apps/web/prisma/schema.prisma`, run `npm run db:erd`
  and `npm run db:erd:check`. Review and include all changed ERD artifacts with
  the schema/migration change. Data-only migrations also require regeneration;
  the ERD records a migration-set fingerprint. Do not hand-edit generated ERD
  files or omit unconnected tables and historical-reference columns.
- Local development deliberately uses the current Prisma schema, not migration
  history. For a clean local database, use `npm run db:reset`; for an existing
  local database, use `npm run db:push --workspace @meadtools/web`. Do not run
  `prisma migrate dev` or `prisma migrate deploy` against the local development
  database unless the user explicitly asks to test migration behavior.
- `npm run db:reset` deletes the local Docker database volume, rebuilds the
  database from `schema.prisma` and seeds it, so every local test record is
  lost. Confirm scope before running it, and verify the schema and seed
  changes together before asking the user to reset.

# Optional agent tooling

If you work on MeadTools with an AI coding agent, these skills, plugins and MCP
servers have proved useful. None is required: the repository rules live in
[`AGENTS.md`](../AGENTS.md), and work must not depend on any of these being
installed.

Install them in your own agent configuration. Their local files (`.agents/`,
`skills-lock.json`, `.claude/`, `.codex/`, `.mcp.json`) are Git-ignored; never
commit them or any credentials or project IDs they contain.

## Skills

| Skill                              | Source                                                              | Useful for                                                                                              |
| ---------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `stripe-best-practices`            | Stripe's published agent skills (`docs.stripe.com`)                 | Credit checkout and billing in `apps/web/lib/billing/` and the Stripe webhook route                     |
| `stripe-docs`, `upgrade-stripe`    | Stripe's published agent skills (`docs.stripe.com`)                 | Looking up Stripe APIs; upgrading the Stripe SDK or API version                                         |
| `supabase-postgres-best-practices` | [`supabase/agent-skills`](https://github.com/supabase/agent-skills) | Prisma schema, migration and query work (hosted databases run Postgres on Supabase)                     |
| `supabase`                         | [`supabase/agent-skills`](https://github.com/supabase/agent-skills) | Hosted database tasks. Local development uses the Docker Postgres from `npm run db:reset`, not Supabase |

## Plugins

| Plugin                                          | Useful for                 |
| ----------------------------------------------- | -------------------------- |
| `expo` (Claude Code, `claude-plugins-official`) | Expo work in `apps/mobile` |

## MCP servers

| Server                                           | Useful for                                                                                                                     |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| `next-devtools-mcp` (`npx -y next-devtools-mcp`) | Inspecting the running Next.js dev server for `apps/web`                                                                       |
| Supabase MCP (`https://mcp.supabase.com/mcp`)    | Inspecting a Supabase project you have access to. Scope it to one project and prefer read-only mode, especially for production |
| MeadTools MCP (this repository)                  | Testing MeadTools' own MCP tools from an AI client; see [`mcp-client-testing-plan.md`](mcp-client-testing-plan.md)             |

## Maintainer-only tooling

Larry keeps a local `meadtools-monthly-release` skill for release checkpoints.
Everything it relies on is documented in the `docs/monthly-release-*.md` files,
so contributors do not need it.

## Keeping this list current

Add a tool here when it has helped with real work in this repository, and say
what it is useful for. Remove tools the project no longer uses. Do not add
setup that only works on one person's machine; link a local runbook from that
person's ignored notes instead.

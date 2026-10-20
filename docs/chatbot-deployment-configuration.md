# Hosted deployment configuration

The intended code default is GPT-5.6 Luna, medium reasoning, minimal orchestration,
twelve tool calls, fourteen provider calls and 100,000 cumulative provider tokens per turn. Authentication, account ownership,
schema validation, unsaved drafts and explicit mutation confirmation
are unchanged. The approved minimal-mode model comparisons support this choice;
sensor history and the remaining evaluation findings do not block this configuration
change. This change does not itself deploy or enable chat in another environment.

`CHATBOT_OPENAI_MODEL` still deliberately overrides the model, with surrounding
whitespace trimmed. An absent/blank override uses Luna. Guided orchestration,
its policy, argument rewriting, forced sequences and answer replacement are
removed. `CHATBOT_ORCHESTRATION` is no longer read; stale settings cannot restore
the deleted path. `CHATBOT_REASONING_EFFORT=low` remains an intentional override, otherwise
medium is used. These are server settings, not client request fields.

The shared local development server follows these code defaults. The final approved
seven-turn profile check confirmed Luna/medium and the accepted limits without
recording configuration secrets. See [PR readiness](chatbot-pr-readiness.md) for
the current verification results; older evaluation reports are historical evidence.

## Pricing and deployment ordering

The insert-only migration
`20261019000000_add_openai_gpt56_luna_credit_pricing` creates the immutable Luna
snapshot, matching runtime billing, seed and pricing-sync registration. It uses
`ON CONFLICT (provider, model, version) DO NOTHING` and does not update historical
rows. The snapshot separately accounts for uncached input, cached input and output;
it does not guarantee future provider pricing. The existing monthly price review
remains applicable.

`apps/web/package.json` runs `prisma migrate deploy` first in `vercel-build`, before
client generation and the application build. A failed migration prevents later
steps. New databases receive the same pricing through seed; existing deployed
databases receive it through this migration. Both new migrations were subsequently applied successfully to a disposable local
PostgreSQL database during PR verification; no main development or remote database
was migrated. Existing explicit model overrides still
require matching active billing prices and an approved evaluation.

## Remote environment audit status

Read-only audit on 2026-10-20 confirmed the configured Vercel project is
`mead-tools` in `larry-reauxs-projects`. The connector still returns HTTP 403 for
environment metadata, and no CLI fallback is installed. The signed-in Vercel
dashboard provided the metadata instead: searching all environments for `CHATBOT`
showed only `CHATBOT_USAGE_ENVIRONMENT` (Production), `CHATBOT_ENABLED`
(Production and Preview), and `CHATBOT_ALLOWED_USER_IDS` (a different Preview
branch). The Shared tab had no matching variables. No values were revealed.
There are no project or linked shared model, reasoning, orchestration or budget
overrides, including branch-specific overrides. A future build of this change
will therefore use the tested model/reasoning/budget defaults.

The latest successful Preview build (`dpl_3W3mekhivzkA2vXnvpT72ySyxVGh`, commit
`b60b024d304fa045d728bec496a293b081359d58`) reported 33 migrations and “No pending
migrations to apply.” The latest successful Production build
(`dpl_8CbrbiDKPLLV84D2cneQze2P4nFh`, commit
`9e12a333caa07a2552bb21be9bf1a1e8b5fdc7a0`) reported 25 migrations and the same
result. These are build-time observations of the deployed revisions, not direct
queries of the databases' current migration tables.

The new Luna pricing and sensor-history index migrations are still uncommitted
local files and are absent from both deployed revisions. Their remote application
cannot be verified before deploying a revision that includes them. Each deployment
runs `prisma migrate deploy` before client generation and the application build;
verify both migration names completed in that build before promotion. No remote
configuration, database data or deployment was changed in this audit.

## Deterministic verification

Configuration tests cover the Luna/medium defaults, ignored obsolete
orchestration settings, model overrides, enable/key gates
and bounded limits. Pricing tests bind the migration snapshot to the default model
and runtime rates, check cached billing and verify migration-before-build ordering.
The final verification passed 512 deterministic tests, all workspace typechecks,
API contract/OpenAPI generation, package boundaries and a production build.
Lint completed with zero errors and 119 existing warnings. PostgreSQL verification
passed the 15 premium foundation tests and the account-read integration fixture;
CI now runs both after applying migrations to its test database.
The final approved seven-turn provider/UI batch is documented in
[PR readiness](chatbot-pr-readiness.md). No remote settings, deployment or PR was created.

## Multi-brew budget follow-up

The compact-context live comparison still stopped at 66,774 cumulative provider
tokens. The code defaults now allow 100,000 cumulative tokens, twelve tool calls
and fourteen provider calls so a thorough two-brew comparison can include both
detail reads, both manual histories, both sensor histories, search/fetch, an input
repair and a final answer. This is a cumulative repeated-input allowance, not a
larger per-request context or output allowance. The 60,000-character request limit,
4,000 per-response / 8,000 combined output limits and credit accounting remain.
Operators may retain smaller budgets. Token checks still occur between responses.
The higher budget has deterministic coverage and a completed two-turn provider retest (see [results](chatbot-higher-budget-retest.md)); the comparison finished at 73,716 tokens, with later citation/interpretation fixes verified in [record identity retests](chatbot-record-identity-retest.md);
no environment file or remote deployment was changed. Explicit existing budget
overrides take precedence over these defaults.

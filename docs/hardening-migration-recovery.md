# November 2 hardening migration recovery

Prepared recovery only. Running these production steps, merging this PR, and
redeploying each require Larry's explicit confirmation. No automatic recovery is
added to Vercel builds. Do not publish release notes or announcements yet.

## Evidence and choice

- Release #488 merged as `a34ef2ec3b723d5622532b1aca428d45c0e6da8c`.
- Production deployment `dpl_BzHyDb5JVJoZUXxB4c6MYgQUka2X` failed with
  Prisma P3018 / PostgreSQL 57014 after approximately 122 seconds in
  `ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY`, inside
  `20261101010000_harden_server_only_database`.
- The preceding deployment `dpl_8CbrbiDKPLLV84D2cneQze2P4nFh` is READY at
  `9e12a333caa07a2552bb21be9bf1a1e8b5fdc7a0`. Verify the current production
  domain assignment again before recovery; READY alone is not proof of routing.
- Build output shows earlier migrations advancing through brew images. It does
  not prove current database state. Live production/Preview migration rows,
  checksums, permissions, and blocking sessions have **not** been read by this PR.
  Complete the preflight below; stop if its assumptions do not hold.

Lock contention is plausible, not proven by 57014 alone. RLS changes require
strong table locks. The original DO block contains no COMMIT or exception
handler: effects within that failing statement roll back together. Earlier
migrations remain independent. Do not infer the state of the entire migration
file or earlier operator attempts from this: its final function ALTER is a
separate statement, and an interrupted/manual run may leave partial effects.

Keep every migration file unchanged. Preview already had a successful release
candidate deployment; changing an applied migration risks checksum divergence.
A new later migration alone cannot run while Prisma records an unresolved
failure. `resolve --rolled-back` only changes history; it does not undo SQL and
would re-run the same broad lock-taking statement during the build.

Use Prisma 6's **manually complete, then resolve as applied** recovery path.
The SQL wrapper acquires all original application table locks with NOWAIT,
replays the exact original file, and verifies its effects in one transaction.
Busy tables fail immediately without leaving earlier acquired locks or changes
behind. Other locks are bounded at one second; each statement is capped at
30 seconds and idle transactions at 15 seconds. This is not a zero-lock change:
a successful attempt briefly locks all these tables. Use a supervised quiet
window, pause concurrent deploys/migrations, and coordinate application traffic
if necessary. Never automatically retry or terminate application sessions.

The original operations are convergent (ENABLE RLS, REVOKE, ALTER DEFAULT
PRIVILEGES, SET search_path), so replay handles already completed subsets.
An assertion failure rolls the wrapper back. Inherited API-role privileges
cause a stop for investigation, not broader changes to managed roles.

## 1. Read-only preflight

Use a reviewed checkout of this PR, the same migration owner as the original
deployment, and a verified **direct PostgreSQL or session-pooled connection**
(not transaction pooling). Confirm the Supabase project identity privately.
Do not print passwords or copy connection strings into issues or logs. Examples
assume a locally configured libpq service named `meadtools-production` and
separately supplied matching `DATABASE_URL` / `DATABASE_DIRECT_URL` for Prisma.
Do not retrieve Vercel secrets merely to fill these variables.

From `apps/web`, verify the published file:

```sh
shasum -a 256 prisma/migrations/20261101010000_harden_server_only_database/migration.sql
```

Expected SHA-256:
`f82e7537b504b374e8fe8d7bcf5ce726029ad98a7f216742a6865a1a8eed60ed`.

Run these reads on production and, with its own verified service, Preview:

```sh
psql -X 'service=meadtools-production' --set ON_ERROR_STOP=1 <<'SQL'
BEGIN READ ONLY;
SET LOCAL statement_timeout='10s';
SELECT current_database(), current_user, inet_server_addr(), inet_server_port();
SHOW statement_timeout;
SHOW lock_timeout;
SELECT migration_name, checksum, started_at, finished_at, rolled_back_at,
       applied_steps_count, logs
FROM public._prisma_migrations ORDER BY started_at;
SELECT c.relname,c.relrowsecurity,c.relforcerowsecurity,c.relowner::regrole,c.relacl
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','S');
SELECT p.oid::regprocedure,p.proconfig,p.prosecdef,p.proacl
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.prokind='f';
SELECT defaclrole::regrole,defaclnamespace,defaclobjtype,defaclacl FROM pg_default_acl;
SELECT pid,usename,state,xact_start,wait_event_type,wait_event,pg_blocking_pids(pid)
FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid();
SELECT l.pid,c.relname,l.mode,l.granted
FROM pg_locks l JOIN pg_class c ON c.oid=l.relation
JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public';
COMMIT;
SQL
```

Compare each recorded migration checksum to SHA-256 of the matching repository
file (including Preview's successful hardening record). Failed attempts and
rolled-back historical attempts may coexist; inspect all rows, not just a
migration-name count. `applied_steps_count` is not an inventory of completed SQL.
Stop for a changed/missing file, unexpected migration, unresolved earlier
failure, different owner, insufficient database visibility, or unexpected drift.
Do not edit `_prisma_migrations` directly or overwrite recorded checksums.

For the expected case: earlier migrations are successful, hardening has an
unfinished/unresolved failed row with this checksum, and pgjwt removal is
pending. If hardening is already successfully recorded, run the verifier and
investigate the newer failure instead; do not resolve it again. If SQL is fully
complete but history is still failed, verify it and proceed to history repair
without needing another SQL replay. Otherwise use step 2.

Confirm server access uses table ownership without FORCE RLS or a reviewed
BYPASSRLS role. Preserve existing owner/server grants and RLS policies. Record
the inventory, live deployment/alias, and a fresh recoverable backup privately;
the November 1 pre-release archive is not a backup of the current schema.

## 2. Complete SQL after explicit approval

From `apps/web`:

```sh
psql -X 'service=meadtools-production' --file scripts/recover-server-only-hardening.sql
psql -X 'service=meadtools-production' --file scripts/verify-server-only-hardening.sql
```

Both must exit zero; the first must show COMMIT. A lock/statement timeout,
permission error, assertion failure, or disconnected client means stop, inspect
the database again, and do not mark applied. Resolve contention through a
supervised quiet window, not by disabling timeouts globally. A disconnected
client around COMMIT is ambiguous: re-read state before deciding to replay.
No production table, row, policy, role, or history row is dropped by this script.
The wrapper intentionally leaves the Prisma failure record unresolved.

## 3. Reconcile Prisma history after verified SQL completion

Verify the Prisma environment targets exactly the database/owner just checked.
Use the lockfile-installed Prisma 6.19.3 and the existing config that deliberately
does **not** load `.env` files:

```sh
npx --no-install prisma migrate resolve --applied 20261101010000_harden_server_only_database --config prisma.test.config.ts
npx --no-install prisma migrate status --config prisma.test.config.ts
```

`status` can still report the pending pgjwt removal and exit nonzero. Inspect
the history again: a successful hardening row must have the original checksum,
and no unfinished, non-rolled-back failure may remain. Prisma manages historical
failed rows itself. If history repair fails after SQL committed, do not undo the
hardening: re-verify state and retry only the history step after investigation.

## 4. Separately approve the remaining migration and deployment

Review `20261101020000_remove_unused_pgjwt` and its dependency-safe, no-CASCADE
DROP EXTENSION before authorizing it. It is deliberately outside the recovery
transaction. After approval, run `prisma migrate deploy --config
prisma.test.config.ts` against the verified target or let the approved production
build run it, then require `migrate status` to succeed. Do not mark that migration
applied without actually completing it. A dependency failure needs its own review.

Use this bug-only PR into `main` for the urgent operations fix. Do not arm
auto-merge, apply readiness labels, dispatch the hotfix gate, or merge without
fresh exact-SHA approval under `monthly-release-gate.md`. Bring the same commit
back to `preview` afterward through normal review. This PR adds no public notes,
activation, Mobile dispatch, or email trigger.

After the approved deployment, verify READY, actual domain assignment and SHA,
complete migration history, owner/server access, API-role denial, ledger
immutability, signed-in/private reads, Chat reconciliation, and the selected
premium/inventory/photo smoke tests. Keep the existing release availability
controls. Record results in the release record before requesting publication.

## Validation

The Quality job runs `node scripts/verify-hardening-recovery-postgres.mjs` from
`apps/web` on disposable PostgreSQL. It applies the real earlier migrations,
creates an actual Prisma timeout failure, proves P3009 blocks subsequent work,
checks fast lock rejection, simulates partial completion and final-statement
failure, verifies transaction rollback and repeatability, resolves via Prisma,
and checks the unchanged checksum and subsequent migration. Existing hardening
tests cover fresh deployment, API denial, server access, and future-object grants.
These tests do not establish the current hosted database state.

References: [Prisma 6 failed migration recovery](https://www.prisma.io/docs/orm/v6/prisma-migrate/workflows/patching-and-hotfixing#failed-migration),
[PostgreSQL lock and statement timeouts](https://www.postgresql.org/docs/15/runtime-config-client.html),
[failed deployment](https://vercel.com/larry-reauxs-projects/mead-tools/BzHyDb5JVJoZUXxB4c6MYgQUka2X).

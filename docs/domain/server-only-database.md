# Server-only database access

MeadTools accesses application data through Prisma. NextAuth and the custom
application access-token checks run at the web/API boundary; they do not create
Supabase Auth identities. Keep the Supabase Data API disabled and automatic
table exposure off in both hosted projects:

| Environment | Project | Data API | Automatically expose new tables |
| --- | --- | --- | --- |
| Production | `csiugwcsyxvggstbitbm` | disabled | off |
| Preview | `txsgahpjgtwopfezjhky` | disabled | off |

These settings were verified in the dashboards on November 1, 2026. Both
application ingredients endpoints returned HTTP 200 afterward. These smoke
checks do not replace testing signed-in flows after deployment.

Preview runs Postgres 17.6.1.063 in us-west-2. Production runs 15.1.1.41 in
us-east-1. Their database versions and regions are intentionally unchanged;
version parity requires a separately planned production upgrade. Both projects
use the Free plan and have no included managed backups.

## Proposed November 2 migrations

`20261101010000_harden_server_only_database` enables RLS on public application
tables, including November's new tables, revokes API-role/PUBLIC access, fixes
the credit-ledger trigger's search path, and makes future objects created by
the migration role private by default. It does not FORCE RLS, introduce
`auth.uid()` policies, or remove the privileges of independent server roles.
Owners/BYPASSRLS server roles retain their existing access. This does not add
database-enforced per-user isolation to the shared server connection; the app
must continue its ownership checks.

Supabase-managed extension routines are excluded from routine changes. The
migration does not alter managed-role default privileges: keep the dashboard
automatic exposure control off as well. New public functions must deliberately
grant access if a future integration needs them.

`20261101020000_remove_unused_pgjwt` removes an extension unused by the app. It
does not use CASCADE, so database dependencies block removal rather than being
deleted. No tracked pgjwt dependencies or public sign/verify function references
were found in production during the read-only inspection. Recheck both hosted
projects and obtain a verified backup before deployment. The migration tolerates
the extension already being absent on newer projects and local PostgreSQL.

Neither migration performs the Postgres version upgrade, changes credentials,
or modifies the administrative Supabase MCP configuration.

## Release and recovery

Issue #491's earlier after-November-2 hotfix schedule was superseded by Larry's
November 1 request to propose these changes for the November 2 release. Keep
PR #488 in draft, without release-ready or auto-merge, until the expanded diff,
CI, backup readiness, and exact final head/base have been reviewed and approved.
November 9 remains a configuration/activation launch.

Before applying the migrations:

1. Create a compressed, encrypted schema/data backup with its restore metadata.
   The proposed off-site destination is a dedicated folder on `/srv/backup` on
   Larry's Jellyfin server, outside the media-mirror folders. Keep recovery keys
   separately and test restoration in an isolated database.
2. Confirm the server connection role remains an owner/BYPASSRLS role, and audit
   other consumers before changing the server-only assumption.
3. Confirm the release's existing sensor-history migration is applied normally;
   do not create its index manually beforehand.

After deployment, check signed-in login, private account reads, credit
reconciliation/idempotency, premium, inventory/equipment, and photo metadata.
Recheck advisers and logs. RLS-without-policy notices are expected for tables
that deliberately deny all API-role access.

The configuration changes and uncommitted migration proposal are not proof of a
backup or a production deployment. Removing pgjwt only clears an upgrade blocker;
schedule and verify the actual Postgres upgrade separately.

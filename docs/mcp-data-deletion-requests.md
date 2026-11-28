# MCP data deletion requests — operator runbook

The MCP section of the privacy policy (approved November 7, 2026; publishes with
the December 2026 release) promises that verified requests to delete an account
or its MCP records are completed **within 30 days**, except information kept for
legal obligations, disputes or abuse prevention. This manual procedure covers
the MCP portion of a verified request. Larry Reaux performs it with reviewed
SQL against production.

## 1. Receive and verify

1. Requests arrive at contact@meadtools.com or the contact page. Record the date
   received; the 30-day clock starts when the request is verified.
2. Verify the requester controls the account: reply to the account's email
   address and require confirmation from that mailbox. Do not act on a request
   from a different address.
3. Clarify the scope: MCP records only, or the whole account. For the latter,
   see [Whole-account requests](#whole-account-requests).
4. Ask whether any legal hold or open abuse investigation applies. If so, keep
   only what that requires and note why.

## 2. What is deleted

Rows keyed to the account in these tables:

| Table | Contents |
| --- | --- |
| `mcp_oauth_sessions` | Connections, permission scope, token hashes, use times. Deleting cascades to `mcp_oauth_consumed_refresh_tokens`. |
| `mcp_oauth_codes` | Short-lived authorization codes. |
| `mcp_access_tokens` | Legacy/static MCP access token hashes. |
| `mcp_draft_handoffs` | Recipe drafts opened from an MCP handoff link. Access expires after 24 hours. The stored row can remain until expired drafts are cleaned up. |
| `mcp_tool_leases` | In-flight tool-call leases for rate limiting. |
| `mcp_tool_usage` | Metadata-only usage records (tool name, result category, duration, time). |
| `mcp_rate_buckets` | The account's rate-limit counter. |

Not per-account and not deleted by this routine: `mcp_oauth_clients` (dynamic
client registrations shared by all users of a client) and
`mcp_registration_budget`. Copies already received by ChatGPT, Claude or another
connected service are outside MeadTools' control; tell the requester to use that
service's privacy controls. Backup copies age out under the general policy.

Deleting sessions immediately disconnects every MCP connection for the account.

## 3. SQL (run in one transaction)

After verifying the requester, look up the account and record its ID. In the
same database session, substitute both the verified ID and email below. The
transaction stops if they fail to match a single account.

```sql
BEGIN;

CREATE TEMP TABLE mcp_deletion_target ON COMMIT DROP AS
SELECT id FROM users
WHERE id = <verified user id> AND email = '<verified account email>';

DO $$
BEGIN
  IF (SELECT count(*) FROM mcp_deletion_target) <> 1 THEN
    RAISE EXCEPTION 'Verified account ID and email do not match';
  END IF;
END $$;
```

Run these counts before and after the deletes.

```sql
SELECT 'mcp_oauth_sessions' AS t, count(*) FROM mcp_oauth_sessions WHERE user_id = (SELECT id FROM mcp_deletion_target)
UNION ALL SELECT 'mcp_oauth_codes', count(*) FROM mcp_oauth_codes WHERE user_id = (SELECT id FROM mcp_deletion_target)
UNION ALL SELECT 'mcp_access_tokens', count(*) FROM mcp_access_tokens WHERE user_id = (SELECT id FROM mcp_deletion_target)
UNION ALL SELECT 'mcp_draft_handoffs', count(*) FROM mcp_draft_handoffs WHERE user_id = (SELECT id FROM mcp_deletion_target)
UNION ALL SELECT 'mcp_tool_leases', count(*) FROM mcp_tool_leases WHERE user_id = (SELECT id FROM mcp_deletion_target)
UNION ALL SELECT 'mcp_tool_usage', count(*) FROM mcp_tool_usage WHERE user_id = (SELECT id FROM mcp_deletion_target)
UNION ALL SELECT 'mcp_rate_buckets', count(*) FROM mcp_rate_buckets WHERE user_id = (SELECT id FROM mcp_deletion_target);
```

```sql
DELETE FROM mcp_oauth_sessions WHERE user_id = (SELECT id FROM mcp_deletion_target);
DELETE FROM mcp_oauth_codes    WHERE user_id = (SELECT id FROM mcp_deletion_target);
DELETE FROM mcp_access_tokens  WHERE user_id = (SELECT id FROM mcp_deletion_target);
DELETE FROM mcp_draft_handoffs WHERE user_id = (SELECT id FROM mcp_deletion_target);
DELETE FROM mcp_tool_leases    WHERE user_id = (SELECT id FROM mcp_deletion_target);
DELETE FROM mcp_tool_usage     WHERE user_id = (SELECT id FROM mcp_deletion_target);
DELETE FROM mcp_rate_buckets   WHERE user_id = (SELECT id FROM mcp_deletion_target);
```

After the second count, run `COMMIT;` separately when every count is zero.
If a check fails, run `ROLLBACK;` and investigate.

## 4. Close out

1. Reply to the requester confirming completion and the date, and mention the
   connected AI service's own controls.
2. Keep a minimal log outside the repository: request date, verification date,
   completion date, scope, and any retained category with its reason. Do not
   record tokens or the deleted data.
3. If the 30-day window cannot be met, tell the requester before it expires.

Local check (November 7, 2026): the six deletes ran against the local
development database for the synthetic review account
(`mcp-owned-review-demo@meadtools.test`) inside a transaction. Before: 1
session, 1 code, 19 usage rows and 1 rate bucket. Inside the transaction every
table reached 0 with no foreign-key errors; the transaction was then rolled
back and all rows were restored. No production data was touched.

Disposable database check (November 26, 2026): the current SQL rejected a
mismatched account ID and email, removed all seven record types for the verified
account, and preserved another account's records. A dependent session record
was also removed through the test fixture's foreign key cascade.

## Whole-account requests

The current [admin deletion helper](../apps/web/lib/db/users.ts) deactivates
the MeadTools account and queues removal of its images. The MCP SQL above
erases the covered MCP records. A complete account erasure also requires a
separate, reviewed account-level procedure. Account for:

- Password and Google sign-in records, existing app and browser sessions, and
  hydrometer credentials. The shared auth verifier still accepts some
  credentials for inactive accounts, so verify that protected routes deny
  access as part of closing the request.
- Saved and public recipes, brews, images, device readings, comments, ratings,
  inventory and equipment, and hosted chat conversations and drafts.
- Billing and prompt-credit records, including records linked indirectly to the
  account. Document any specific legal or other approved retention exceptions.
- Object storage, monitoring providers, support messages, and backup copies
  that may retain associated data.

Use the [database ERD](./database/README.md) to review dependencies. Track the
request as in progress until the account-level work and applicable provider
checks are complete. Confirm completion only for the scope actually fulfilled.

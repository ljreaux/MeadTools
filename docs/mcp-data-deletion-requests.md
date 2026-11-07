# MCP data deletion requests — operator runbook

The MCP section of the privacy policy (approved November 7, 2026; publishes with
the December 2026 release) promises that verified requests to delete an account
or its MCP records are completed **within 30 days**, except information kept for
legal obligations, disputes or abuse prevention. There is no automatic purge, so
this manual routine is how that promise is kept. Larry Reaux performs it with
reviewed SQL against production.

## 1. Receive and verify

1. Requests arrive at contact@meadtools.com or the contact page. Record the date
   received; the 30-day clock starts when the request is verified.
2. Verify the requester controls the account: reply to the account's email
   address and require confirmation from that mailbox. Do not act on a request
   from a different address.
3. Clarify the scope: MCP records only, or the whole account. Whole-account
   deletion follows the general privacy policy and must include this routine.
4. Ask whether any legal hold or open abuse investigation applies. If so, keep
   only what that requires and note why.

## 2. What is deleted

Rows keyed to the account in these tables (all reference `users` with
`ON DELETE RESTRICT`, so they must be removed before any `users` row delete):

| Table | Contents |
| --- | --- |
| `mcp_oauth_sessions` | Connections, permission scope, token hashes, use times. Deleting cascades to `mcp_oauth_consumed_refresh_tokens`. |
| `mcp_oauth_codes` | Short-lived authorization codes. |
| `mcp_access_tokens` | Legacy/static MCP access token hashes. |
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

Replace `<account email>` in every statement. Run the preview first; if the
account lookup does not return exactly one row, stop.

```sql
-- Preview: confirm the account and current row counts.
SELECT id, email, active FROM users WHERE email = '<account email>';

SELECT 'mcp_oauth_sessions' AS t, count(*) FROM mcp_oauth_sessions WHERE user_id = (SELECT id FROM users WHERE email = '<account email>')
UNION ALL SELECT 'mcp_oauth_codes', count(*) FROM mcp_oauth_codes WHERE user_id = (SELECT id FROM users WHERE email = '<account email>')
UNION ALL SELECT 'mcp_access_tokens', count(*) FROM mcp_access_tokens WHERE user_id = (SELECT id FROM users WHERE email = '<account email>')
UNION ALL SELECT 'mcp_tool_leases', count(*) FROM mcp_tool_leases WHERE user_id = (SELECT id FROM users WHERE email = '<account email>')
UNION ALL SELECT 'mcp_tool_usage', count(*) FROM mcp_tool_usage WHERE user_id = (SELECT id FROM users WHERE email = '<account email>')
UNION ALL SELECT 'mcp_rate_buckets', count(*) FROM mcp_rate_buckets WHERE user_id = (SELECT id FROM users WHERE email = '<account email>');

BEGIN;
DELETE FROM mcp_oauth_sessions WHERE user_id = (SELECT id FROM users WHERE email = '<account email>');
DELETE FROM mcp_oauth_codes    WHERE user_id = (SELECT id FROM users WHERE email = '<account email>');
DELETE FROM mcp_access_tokens  WHERE user_id = (SELECT id FROM users WHERE email = '<account email>');
DELETE FROM mcp_tool_leases    WHERE user_id = (SELECT id FROM users WHERE email = '<account email>');
DELETE FROM mcp_tool_usage     WHERE user_id = (SELECT id FROM users WHERE email = '<account email>');
DELETE FROM mcp_rate_buckets   WHERE user_id = (SELECT id FROM users WHERE email = '<account email>');
-- Rerun the preview counts here: every table must show 0.
-- COMMIT if all zero; otherwise ROLLBACK and investigate.
COMMIT;
```

The deletes match the preview's account by email inside the same transaction,
so a typo affects zero rows rather than another account. For whole-account
deletion, run this first, then the account-level deletion under the general
policy in the same change window.

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

# Automatic product-update email

One nullable `users.product_updates_opt_in` value tracks consent: `NULL` means
the user has not answered the banner; `true` opts in; `false` declines or opts
out. The account switch can change it later. The forward migration preserves
earlier per-product answers by opting in anyone who chose at least one product.
No recipient or delivery-history table is retained.

The production-only `/api/cron/product-updates` Vercel cron runs every five
minutes using the existing `CRON_SECRET`. It reads the newest dated website
entry that is no more than seven days old and has at least one shipped product
section. It ignores Mobile preview-only entries and no-change months. It sends
one combined message, with separate sections for shipped products, through the
existing SMTP sender (`EMAIL_USER` and `EMAIL_PASS`). Signed unsubscribe links
use the existing `NEXTAUTH_SECRET`; no new environment variable is needed.

Before sending can start, put a verified postal address in
`apps/web/lib/product-update-email.ts`. Until then, the cron returns
`postal-address-needed` and sends nothing. Confirm the sender configuration,
public release notes, and product availability before publishing a dated entry
to production; publication initiates the email automatically.

`users.product_updates_last_emailed_date` is an at-most-once claim marker. The
cron claims each recipient before calling SMTP and rechecks consent immediately
before the send. Concurrent runs cannot claim the same user twice. A failed or
ambiguous SMTP attempt is not automatically retried; check aggregate cron logs
and resolve it without risking duplicate mail. This is the small-data tradeoff
for avoiding a delivery ledger.

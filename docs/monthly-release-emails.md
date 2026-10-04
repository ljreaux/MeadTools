# Monthly release emails

Release announcements use the existing Office 365 SMTP sender and only the
product choices recorded by signed-in accounts. They are disabled by default.
The account banner asks once; the account settings dialog and each email's
product-specific unsubscribe link allow a later opt-out.

## Before sending

1. Deploy the dated, public release note and verify its product sections. A
   Mobile preview-only section does not qualify as a shipped Mobile email.
2. Configure `RELEASE_EMAIL_POSTAL_ADDRESS` in the Vercel **production**
   environment with a valid mailing address. The sender also requires the
   existing `EMAIL_USER`, `EMAIL_PASS`, and a production
   `NEXT_PUBLIC_BASE_URL` of `https://meadtools.com` (or its `www` variant).
   Do not put these values in Git.
3. Open `/admin/release-emails` in the production site. Select one dated
   release and one shipped product. Prepare recipients, then review the
   resulting counts. Preparation does not send email.
4. Type the exact displayed confirmation and send the next batch. Each click
   sends at most ten messages, and the server limits claims to 20 per rolling
   minute across all products. Refresh the counts between batches.

Preparation records one delivery per release, product, and user, so repeating
it cannot create duplicates. The sender rechecks account status and product
consent immediately before SMTP. `SENT` is the only confirmed delivery state.
`FAILED` and stranded `SENDING` rows may represent an email accepted by SMTP
before a timeout, so they are never retried automatically. Review provider
records and the recipient case manually before considering another send.

The route refuses to send outside a Vercel production deployment or without a
configured mailing address and sender. No-change months have no dated shipped
product section and therefore create no email batch.

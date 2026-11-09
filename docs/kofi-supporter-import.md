# Private Ko-fi launch reconciliation

Use the authenticated production runtime only after confirming its
`KOFI_EMAIL_DIGEST_SECRET` is the same key used by the active production
deployment. Never rotate that key over existing digests without a reconciliation
plan. The importer rejects an existing CSV identity with different payer proof,
amount, currency or payment minute instead of silently accepting it.

Inputs are Ko-fi's Members export and full Transaction export. Keep both, and
the resulting email/account report, in ignored `.private/kofi/`; never commit or
attach them to a public issue. The report is created with owner-only permissions.

From `apps/web`, first run without `--apply`:

```sh
node --conditions=react-server --env-file=../../.env.prod --import tsx \
  scripts/import-kofi-supporters.ts \
  --members ../../.private/kofi/members.csv \
  --payments ../../.private/kofi/payments.csv \
  --report ../../.private/kofi/nov9-import-result.json \
  --expected-project-ref <production-project-ref>
```

The runtime validates the selected database project. Review the private report
and aggregate counts, then add `--apply` for the authorized import. It sends no
email, calls no model or payment provider, and never matches a payer to an
unverified MeadTools account email. Genuine historical recurring payments for
the active legacy roster populate the existing payment records and use the
existing idempotent monthly allowance logic after verified account linking.
Invalid/future dates, duplicate transaction IDs and unsupported currencies stop
the import. Re-running completed imports is idempotent.

The current launch policy gives eligible one-time incoming tips in the 90 days
before November 9, 2026 midnight Central three months of premium **access only**,
ending February 9, 2027 midnight Central. Existing recurring legacy members are
excluded from the promotional list. These grants are not applied before launch,
and only a verified Ko-fi account link can identify the target user. No credit
grant is created for this offer. Existing later manual grants (including admin
grants) are preserved; revoked or payment-restricted accounts require review.

Unlinked payers remain in the private report. They must use the Premium page's
existing Ko-fi payer-email verification flow; rerun the import after they link.
They do not need to use the same email for their MeadTools sign-in. Refresh the
payment export before November 9 if support received after the original export
should be included. Do not send invitations without Larry's authorization.

Before relying on webhook retries for imported transactions, deploy the bundled
CSV/webhook identity reconciliation fix. It recognizes a synthetic CSV message
ID only when the transaction, payer digest, amount, currency and timestamp minute
all agree, while ordinary webhook identity mismatches remain rejected.

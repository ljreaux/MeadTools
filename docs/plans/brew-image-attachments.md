# Brew image attachments: implementation and release checks

Status: local implementation, October 25, 2026. Local R2 uploads, private reads,
captions, removal and signed-link expiry have been verified. Preview/production
configuration and release verification remain outstanding. Tracks [#472](https://github.com/ljreaux/MeadTools/issues/472);
expiry and activation policy must align with
[#474](https://github.com/ljreaux/MeadTools/issues/474).

Provider decision: the user selected Cloudflare R2 on October 25. The limits and
server upload path below are implemented locally. Both private R2 buckets have
been provisioned; the local server uses nonproduction credentials.

## Architecture

Use a private production bucket and a second bucket shared by local development
and Preview, with distinct object prefixes for those two environments. Use the existing
MeadTools server handling authorization and image processing. Keep attachment
metadata in PostgreSQL and image bytes in object storage. No separate image
server or paid image transformation service is needed for v1.

R2 is enabled. Public bucket access is disabled in both environments.

## Existing integration points

- `apps/web/prisma/schema.prisma` has owned brews and a public flag, but no brew
  attachment model in the base schema; this change adds it and an R2 storage client.
- `apps/web/lib/db/brews.ts` owns brew mutations and public projections. Public
  retrieval requires both a public brew and a non-private linked recipe. Image
  access must reuse that complete decision, including after visibility changes.
- `apps/web/lib/db/premium-access.ts` supplies the existing premium decision.
- `packages/brew-domain` owns reusable projections; `packages/api-contract`
  owns client-facing schemas. Neither should know bucket names or object keys.
- `apps/web/components/brews/BrewViewer.tsx` is the existing public viewer;
  both public and editable account views include a Photos tab and inline attachments.
- Brew deletion is transactional. Account deletion currently sets `active:
  false`; database cascades alone will not remove stored photos.

## Product limits

These limits are enforced by shared policy and server validation. Final paid-plan
benefit copy is part of #474.

| Setting | Limit |
| --- | --- |
| Images per brew | 20, including pending uploads |
| Account allowance | 250 MiB, including thumbnails and reservations |
| Supported input | JPEG, PNG, WebP; still images only |
| Original selected file | Up to 20 MiB; reduce on the client before sending |
| Uploaded payload | Up to 3 MiB; independently enforce on the server |
| Stored display image | WebP, longest edge at most 1,600 px, at most 1 MiB |
| Stored thumbnail | WebP, longest edge at most 320 px, at most 64 KiB |
| Caption | Optional, up to 500 characters |

Use a target quality and lower quality/dimensions when needed to meet the byte
cap. Never retain the original. The server must decode and re-encode, verify
content against the declared format, bound decoded pixel count, normalize
orientation, and strip EXIF/GPS and other unnecessary metadata. Browser
compression is an upload optimization, not validation.

HEIC/HEIF support is not promised. Test actual iPhone camera and photo-library
selection early; native HEIC files need a deliberate conversion solution if the
phone does not provide a supported format. This is a release decision, not an
error to discover at the end of development.

## Upload, access, and cleanup

Uploads use the existing server after browser resizing.
This avoids a separate raw-upload staging system for v1. Measure processing
time and upload costs on Preview before accepting this path for release.

The implemented path is browser resize -> authorized Vercel handler -> validate,
re-encode and create thumbnail -> private R2 objects. R2 replaces the storage
destination, not the Vercel processing step. Both providers support direct
browser uploads (R2 through signed PUT URLs; Blob through its client SDK), but
that alternative needs private staging, server-side validation before publication,
and cleanup of abandoned uploads. It does not eliminate processing costs.
For small, bounded photos, prefer the simpler server path initially and measure.

Reserve the maximum stored bytes and an attachment slot transactionally before
processing. Serialize quota decisions per account so simultaneous requests
cannot oversubscribe the allowance. Use a client-generated idempotency key;
retries reuse the same operation and immutable object keys. Cap simultaneous
processing per account and apply upload rate limits as well as storage quotas.

Only mark the attachment ready after both normalized objects exist. Convert
reserved bytes to actual usage atomically. Failures must queue object cleanup
and release reservations safely. Keep durable pending-operation and deletion
records so crashes and storage outages can be retried by a scheduled sweep;
do not depend on an in-memory promise after returning a response.

Keep the bucket private, with public bucket access disabled. After checking
ownership or the existing public-brew rules, issue read URLs valid for 60
seconds. Share all ready attachments and captions on eligible public brews;
state this clearly before uploading to a public brew. No per-image visibility
switch in v1. Authorization responses must use `Cache-Control: private,
no-store`; object responses must prevent persistent shared caching. Do not
send these URLs through a public image optimizer/cache.

Implemented revocation policy: previously issued URLs may remain usable for up to
60 seconds after a brew or recipe becomes private, or the owner is deactivated.
New requests must fail immediately. Already downloaded copies cannot be
recalled. If immediate request-level revocation is required, stream through an
authorized server route instead and account for hosting bandwidth.

Attachment removal hides the record immediately and queues both objects for
deletion. Brew removal and account deactivation must enqueue the same cleanup
inside their database transactions, preserving cleanup keys independently of
deleted parent records. Keep bytes charged until physical deletion succeeds
to prevent repeated delete/upload cycles from bypassing the storage cap.
Cleanup runs every 15 minutes in production; verify scheduling and recovery on
the hosted deployment.

Implemented expiry behavior: stop new uploads, retain viewing, caption editing,
and removal for the owner, and preserve existing public visibility. Do not
silently delete photos when a subscription expires. Retained bytes still count
toward the allowance on renewal. Align inactive-account and payment-restricted
behavior explicitly with #474 before release.

## Cost model

Provider list prices checked October 25, 2026; rates and included allowances
can change. These figures exclude existing hosting/database charges, image
processing, application requests, and tax.

- [R2 pricing](https://developers.cloudflare.com/r2/pricing/): Standard storage
  includes 10 GB-month, 1 million writes and 10 million reads monthly. Additional
  storage is $0.015/GB-month; R2 download bandwidth is free. Operations above
  allowance are billed, with provider billing-unit rounding.
- [Vercel Blob pricing](https://vercel.com/docs/vercel-blob/usage-and-pricing):
  the displayed region lists storage at $0.023/GB-month and Blob transfer at
  $0.05/GB, plus operations and applicable delivery charges. Included usage
  depends on the hosting plan; do not assume Hobby allowances on Pro. Private
  images streamed through Functions also incur hosting delivery charges.

Example assumptions: 10,000 photos averaging 500 KB plus 25 KB thumbnails use
about 5.25 GB. That fits R2's included storage if the account has no other usage
and request counts stay within the allowances. At a constant 100 GB, R2 storage
alone is about $1.35/month after the 10 GB allowance. These are illustrative
estimates, not a total-bill guarantee. Account quotas and upload rate limits
are still needed; subscription expiry does not stop retention costs.

[R2 signed URL documentation](https://developers.cloudflare.com/r2/api/s3/presigned-urls/)
supports temporary direct reads, avoiding routing downloaded image bytes through
the web host. Bucket CORS, signing credentials, and separate Preview/production
buckets are setup work; an additional Worker is not required for this design.

## Implementation and release checks

1. Provider selected: R2. Confirm limits, 60-second revocation, and retained
   access policy.
2. Add shared attachment schemas/projection and deterministic operation tests;
   add Prisma models and a reviewed production migration for metadata,
   reservations, and durable cleanup.
3. Add the storage/processing adapters and owned/public API boundaries. Cover
   actual bytes, dimensions, ownership, entitlement, quota races, retries,
   partial object writes, crashes, expiry, visibility changes, and deletion.
4. Add the account gallery with upload progress, retry, captions and removal;
   reuse shared Dialog/AlertDialog/LoadingButton patterns and English locales.
   Verify keyboard focus and phone layout in the existing preview.
5. Generate contracts/OpenAPI, run API contract checks, and review generated
   diffs. Verify upload/reload/view/caption/delete on hosted Preview with real
   storage, including direct URL access and expiry. No real-model calls needed.
6. Ship behind the existing access controls November 2; coordinate November 9
   activation and benefit copy with #474. Do not mark #472 complete until hosted
   storage, cleanup scheduling, phone formats, and all acceptance checks pass.

## Configuration and remaining setup

- Production bucket: `meadtools-brew-images-production`.
- Development/Preview bucket: `meadtools-brew-images-nonproduction`.
- Object prefixes are `production/`, `preview/`, and `development/`; cleanup is
  restricted to its deployment's prefix. Preview and local databases must remain
  separate; do not copy image records between them as if the object keys were portable.
- Set server-only `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`,
  and `R2_BUCKET` separately for development, Preview and production. Use separate
  bucket-scoped credentials for production and nonproduction. Never use public
  environment variable prefixes or paste keys into chat.
- The adapter rejects a bucket name that does not match the deployment. Bucket
  names are deliberately fixed to make accidental production access fail closed.
- Keep public bucket access and `r2.dev` disabled. Configure CORS for GET from the
  actual web origins if needed for delivery; uploads go through the server.
- `PREMIUM_ACCESS_ENABLED` continues to control new uploads through the shared
  premium decision. Missing storage configuration also prevents new uploads.
- Existing Vercel `CRON_SECRET` protects `/api/cron/cleanup-brew-images`; its
  schedule runs every 15 minutes. Local development needs manual invocation or a
  local maintenance runner; Vercel does not schedule Preview crons. Failed or
  removed objects stay charged for at least the writer safety window (10 minutes)
  and until deletion succeeds. Tombstones expire after 30 days.
- The same R2 allowance is shared across both buckets. A second bucket does not
  add a fixed monthly charge. Processing still consumes Vercel resources.

## Local verification recorded

- Production migration applied successfully to an isolated PostgreSQL 16 test
  database initialized from the prior schema; the existing local development
  database was updated additively with `db:push`, without a reset.
- PostgreSQL integration cases cover quota/slot races, duplicate operations,
  partial writes, cleanup retry and quota release, crashed reservations,
  ownership, expiry/restriction/rollout, current public visibility, parent
  deletion/deactivation, and keeping photos after brew completion.
- Processor tests check real format decoding, corruption, animation, pixel/byte
  limits, orientation and metadata removal. Offline R2 signing tests check
  60-second expiry, cache prevention and environment separation.
- Shared domain/schema tests, generated contract/OpenAPI parity and typechecks
  have been run. Generated diffs add only the two image paths and their schemas;
  existing endpoint definitions are unchanged.
- Real R2 upload, private access, expiry and cleanup were verified locally. Hosted
  Preview behavior and actual iPhone selection remain release checks.

Run database integration checks only against the guarded disposable database:
`npm run test:brew-images-postgres --workspace @meadtools/web`, with explicit
`DATABASE_URL`/`DATABASE_DIRECT_URL` pointing to local database
`meadtools_brew_images_test`. The script rejects any other database name or a
remote host and truncates fixture data only in that disposable database.

## October 25 storage verification

R2 activation, both private buckets and nonproduction credentials are configured.
The local web environment has the four required R2 settings. Production credentials and Vercel configuration must be verified separately
before release.

A generated sample image was uploaded through the browser, opened in the viewer,
captioned, reloaded and removed. Stored objects were WebP without EXIF. Unsigned
access was denied; a signed URL expired after its 60-second lifetime. Cleanup
removed both variants and released quota. The sample did not include user data.
Keyboard dismissal and the viewer at a 390px viewport were checked. Actual iPhone
library selection and hosted Preview behavior remain release checks.

## Entry attachments and Photos tab

The owner and public brew views expose Stages, Metrics, Charts, then Photos.
The Photos tab collects every readable attachment. Normal entry photos also
appear inline on their timeline cards. The Add entry dialog prepares selections
and saves the entry before uploading its photos; retrying photos reuses both
the entry ID and upload operation IDs rather than creating another entry.

An upload with `entry_id` attaches to a visible entry in the owned brew. An
upload without it creates a dedicated hidden NOTE entry, so direct brew photos
share the same data relationship without cluttering history. The initial new
migration includes this relationship, as explicitly authorized by the user.
`original_entry_id` preserves orphan detection after an entry is removed.
Entry deletion immediately hides its attachments and queues durable object
cleanup. Removing the last direct photo also removes its empty hidden entry.

The amended migration was applied to a disposable database built from the
base schema. All 15 image integration checks pass, including cross-brew entry
validation, hidden entries, lost-response retries and entry deletion during
upload. The local database was updated with db:push without a reset.

After the server restart, the Add entry flow was verified in the browser using
a generated sample. Its image loaded both inline on the saved note and in
the Photos tab with the note title. The gallery fit a 390px viewport without
horizontal overflow, and Escape dismissed the photo viewer. The temporary
viewport override was reset. The generated entry and photo were removed,
objects cleaned up and quota released.

## Upload UI polish

The shadcn Progress component displays actual browser transfer progress for
both direct and entry uploads. At 100% it shows processing until the server
confirms completion; multiple selected files also show the current photo count.
The entry picker previews the already resized image and retains filename/removal
controls. Skeletons occupy thumbnail space until access and image loading finish.
This adds no additional upload service or client-side image network requests.

Two-photo entry creation and subsequent gallery loading were verified against
real nonproduction R2 in a dedicated temporary local brew. The picker fit a
390px viewport, progress announced the first of two photos and processing state,
and both thumbnails finished with no remaining loading placeholders. The test
brew, entries and objects were removed, and its quota reservation returned to zero.

## Remaining release verification

- Confirm the four R2 settings in Preview and Production, with separate
  bucket-scoped production credentials. Confirm premium activation separately
  from storage configuration; #474 owns launch readiness.
- Verify hosted Preview upload, reload, caption, view, removal and direct URL
  expiry with actual R2 storage. Production cron scheduling does not run on
  Vercel Preview, so its cleanup endpoint must be exercised manually there.
- Verify production cleanup scheduling and retry visibility before activation.
- Test actual iPhone camera/library selection. JPEG, PNG and WebP are supported;
  HEIC is not currently supported.
- Review migration and policy changes before merging. Track #472 until the
  hosted acceptance checks are complete.

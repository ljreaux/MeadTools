# Recipe and brew cover images (#512)

Premium owners can upload a recipe photo to set it as the cover immediately.
Uploads from the brew cover picker also select the cover immediately; ordinary
brew gallery and entry uploads preserve it. A failed upload preserves the
previous cover, and replaying an earlier successful upload does not override a
later cover selection. Existing brew attachments can be selected without another
upload. Display cropping is centered; there is no crop/focal-point editor.

## Presentation

- Detail pages (recipe builder, owner brew page, public recipe and public brew)
  show a full-width, center-cropped banner below the title, options and actions:
  16:9 on phones, 224px tall from `sm`, 256px from `lg`. Public banners open the
  uncropped photo. Owners get a "Change cover image" button on the banner, or a
  single compact "Add cover image" button when there is no cover, so records
  without covers keep their existing layout.
- Lists show small square thumbnails beside titles: account recipe cards, public
  recipe cards (beside the title on phones, beside the whole card from `sm`),
  the owner brew table, connected brews and public brews on a recipe. Brew rows
  reserve a neutral slot only when at least one listed brew has a cover.
- List and detail data carry `cover_image_id`, so records without a cover make
  no cover request. Admin brew lists do not show covers.
- One cover picker dialog (no nested dialogs, except the delete confirmation for
  recipe photos) lists the record's photos as tiles. Selecting a tile sets the
  cover; the current cover is a disabled "Current cover" tile, and "Remove
  cover" keeps the photo. The premium notice appears only in the picker and only
  for accounts that cannot select. Brew photo captions and deletion stay in the
  brew Photos tab, whose photo viewer also offers "Use as cover"/"Current cover".

## Sharing and lifecycle

- Everyone, including signed-out visitors and free accounts, can view covers on
  public recipes and eligible public brews. A public recipe does not expose its
  private linked brews or their images. Selecting a cover never changes sharing.
- Images belong to exactly one recipe or brew. Only a ready, readable image on
  that same owned record can be selected. No cross-record image references.
- Recipe copies and newly started brews have no cover. Upload/select explicitly
  on the new record; no implicit inheritance or shared storage ownership.
- Replacement retains the previous photo (brew Photos tab or recipe cover picker). Removing
  a selection preserves the photo. Deleting a selected photo, its entry, its record or the
  owner's account clears the selection in the same transaction.
- Premium expiry retains viewing/public sharing and allows caption edits, removal
  of selections and photo deletion. New uploads and selections require premium.
- Recipe photos use the existing account-wide 250 MiB allowance, upload rate and
  processing limits, and a limit of 20 photos per recipe. Brew limits stay intact.
- Record/account deletion queues durable cleanup; bytes stay charged until both
  stored variants are deleted. The existing cleanup cron handles both kinds.
- R2 buckets remain private. Reads recheck visibility and return 60-second URLs;
  previously issued URLs can remain usable until expiry. Do not use the public
  Next image optimizer or persist signed URLs.

## Verification

The additive migration applies cleanly on top of the full migration history
in a disposable database, with no cover-related drift from `schema.prisma`.
`verify-brew-images-postgres.mjs` exercises actual database transactions with
deterministic storage, including covers, privacy revocation, ownership, expiry,
replacement, deletion, live-image cover references and the ignored generic
recipe update. Contract/OpenAPI and ERD artifacts are generated alongside the
change. Hosted storage and device checks from `brew-image-attachments.md` remain
release checks.

Local verification on November 7, 2026: the full `npm test` suite, 24
PostgreSQL integration checks, web typechecking and ERD verification pass;
targeted lint has no errors. In the local preview, recipe uploads from the
picker became the cover, replacement kept both photos, re-selection and removal
worked, and focus returned to the trigger on close. Desktop and phone layouts
were checked for the builder, brew page, account and public lists. Signed-out
access was verified at the API level only; the public detail pages were not
viewed while signed out. Preview/production verification remains part of
release review.

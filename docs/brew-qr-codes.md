# Brew QR codes (#473)

Web owners can open **QR code** beside **Share brew** and download a black-on-white
SVG. Generation and every download authenticate using the existing bearer/session
flow, check ownership, and call `getPremiumAccessStatus`. The existing
`PREMIUM_ACCESS_ENABLED` control, active account, unexpired membership, and absence
of payment restrictions are required. No separate rollout control, API route,
schema change, or paid QR service is introduced. The reusable brew-domain operation
uses `uqr`, a zero-dependency local encoder. Native Mobile QR UI is deferred.

The encoded destination is `<NEXT_PUBLIC_BASE_URL>/brews/<brew-id>` (falling back
to `https://meadtools.com` when unset). The request host and branch-deployment host
are never substituted. Configure the public base URL to the canonical production
origin for durable printed labels, including on Preview. It contains no credentials, recipe IDs,
private details, or expiring signatures. Generation never changes sharing.

Existing routes could not serve both public and owner-only brews from one durable
URL: public routes include a recipe ID and reject private records, while account
routes always require sign-in. The new page resolver performs a fresh query for
only a public brew's public linked recipe ID and temporarily redirects to the
existing public viewer. Otherwise it sends every ID through the normal account
brew flow. The account guard preserves the destination in `/login?next=...`;
credential and Google sign-in both honor it. Other owners and deleted IDs receive
the existing generic unavailable brew state. Public viewers need no account or
premium. Public projection and linked-recipe visibility checks are unchanged.

The resolver is dynamic and never permanently redirects or caches a public target.
The public destination also checks visibility, protecting against a sharing change
between redirect and load. Making a brew or linked recipe private, unlinking its
recipe, or deleting the brew removes public access on subsequent requests.

## Post-expiry policy for launch review (#474)

Generation/download requires current premium. Printed links do not: they continue
to obey current brew ownership/sharing rules after expiry, cancellation, payment
restriction, or premium rollout deactivation. Premium is not a permission to view
someone else's private brew. This is the implementation policy to review with the
November bundle, not a new public sharing permission.

## Verification

- Deterministic tests rasterize the generated SVG and independently decode it with
  `jsQR`, including 354 px (30 mm at 300 dpi), 512 px, and 1024 px.
- Domain tests cover configured public URLs, invalid input, ownership, renewed
  checks on download, and entitlement-independent printed destinations.
- Resolver tests cover public-to-private, private recipe, unlinked recipe, and
  deletion, with a minimal public-only query on every scan.
- The isolated server-action fixture exercises real bearer verification, the
  owner-scoped database query, and the existing premium helper with mocked data:
  active, expired, restricted, inactive, rollout-disabled, and anonymous cases.
- Local preview verified October 25, 2026: owned private brew generation and SVG
  download; independent decoding of the downloaded SVG; 390 × 844 mobile layout;
  Enter to open, Escape to close and return focus, and Tab trapping in the dialog.
  The configured `NEXT_PUBLIC_BASE_URL` is used in the actual preview QR.
- Physical phone scan: **pending**. Before closing #473, print a representative
  label at least 30 mm wide with its white border intact; record phone/camera,
  print size, successful decode, and production destination. Codes use the configured public base URL;
  the resolver must be deployed there before end-to-end scanning.
- Release verification must exercise public visitor, signed-in owner, signed-out
  owner returning through both sign-in methods, unauthorized account, and expired
  premium on Preview. Include a public brew whose linked recipe becomes private.

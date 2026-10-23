# MCP recipe draft handoff (issue 462)

The MCP host adds `builderUrl` to successful recipe workflow results. It uses
our configured public application origin (including preview/local configuration).
The link opens `/recipe-draft` directly in the existing RecipeBuilder, not a
separate review/save screen. MCP instructions tell clients to render the actual
returned link unchanged. No MCP write scope is added.

## Builder choice

OwnerRecipe/RecipeClient require a saved record, owner lookup, version gate,
update/delete actions, comments and linked brews. Reusing that host would need
fake saved identity or conditional behavior throughout those paths. RecipeBuilder
already shares the ingredient, nutrient, stabilizer, additive and notes controls
and has the authenticated SaveRecipe confirmation/privacy dialog. We reuse it
with an isolated storage key, initial recipe name and sign-in return path.
Account unit preferences do not override a hydrated draft. RecipeProvider uses
the same shared calculations on hydration and editing. Only explicit confirmation
creates a recipe through the existing create mutation; no saved-record updater
is mounted on this route.

## Format, access and retention

A versioned UTF-8 JSON payload is base64url encoded in the URL fragment, bounded
to 24,000 characters. It includes RecipeDataV2, name, warnings and assumptions;
it excludes derived calculations, saved IDs and ownership. Decoding validates the
shared schema, rejects unknown fields, and reruns shared calculations against
the response schema. Malformed, unsupported and oversized payloads show an error.
Oversized generated drafts return builderLinkError without truncating the recipe.

There is no server handoff record, database migration, access token or expiry.
Anyone holding the original link can read its contents; the link should be treated
as private recipe content. Fragments are excluded from HTTP requests and Referer
headers. This route installs no analytics. Future analytics must omit fragments
and recipe payloads. MCP clients necessarily receive the draft/link in tool output.

On first open, browser localStorage receives a fresh UUID-scoped handoff and
editable recipe. History replaces the fragment with that UUID. The browser keeps
edits through reload and credential/Google sign-in using the existing `next`
redirect support. The resume URL works only in that browser/origin; clearing
browser storage removes it. Reopening the original link creates a fresh copy.
The home draft and saved recipes are never overwritten. Draft storage has no
automatic expiry; clearing site storage removes retained drafts. Storage failures
show a clear error instead of silently falling back to an empty builder.

## Local verification

Deterministic tests cover the round trip, Unicode, schema/version/size failures,
unknown-field rejection, identical shared calculations, edited-draft sign-in
retention, and separate home/source storage. Browser verification confirmed that
a test link hydrates ingredients, changing honey recalculates gravity/ABV, and
Save opens the existing confirmation dialog with the name and privacy enabled.
No save was submitted during this check.

The Codex native MCP connection successfully drafted a blueberry mead and returned
a localhost builder link for user testing. The separate MeadTools Local plugin
connection returned internal errors. Completed sign-in and save submission still
need end-to-end verification; no account write was submitted by the agent. The
draft details use the existing card wrapper with a 24px gap above the builder.

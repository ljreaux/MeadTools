# Brew recipe snapshots

Creating a brew from an owned recipe or another brewer's currently public recipe
copies the saved recipe name and data into the brew. The brew belongs to the
brewer and starts private. The snapshot records the source recipe ID, source
user ID, and source public username at creation time. Saving a copy of a public
recipe remains a separate action.

The recipe builder saves a new recipe before creating its optional brew. If the
second request fails, the saved recipe stays available and the dialog can retry
brew creation using that recipe ID.

An ongoing brew checks an accessible source recipe against its current snapshot.
Recipe content or name changes reveal an explicit update action; a visibility
change alone does not. The confirmation lists changed sections and warns that
future planned amounts, remaining additions, and derived estimates can change.
Recorded entries, readings, measurements, and their payloads are never rewritten.
Entry links to removed recipe item IDs remain on the entries, though new plans
may no longer match those IDs. The complete former snapshot is retained in the
brew data for audit and recovery; the brew page shows only the current snapshot.

Completed brews cannot update their recipe snapshot. For another brewer's
recipe, updates are allowed only while that recipe remains public. If it becomes
private, the brew keeps its current snapshot and source attribution, but its
owner cannot refresh from or open the private source. Making a source private
also makes its linked public brews private, as the existing recipe privacy flow
already does. No source edit silently changes a brew snapshot.

# Brew-entry idempotency

Companion clients may create a brew entry while offline and retry delivery
after reconnecting. `POST /api/brews/{brew_id}/entries` therefore accepts an
optional `client_entry_id` UUID.

## Semantics

1. The client generates one UUID when it creates the local outbox item.
2. Every upload attempt for that item sends the same `client_entry_id`.
3. The server stores that UUID as `brew_entries.id`.
4. Concurrent inserts use PostgreSQL conflict handling, so only one row can be
   created.
5. A retry for the same brew and owner returns the refreshed brew normally.
6. Reusing an existing entry ID for another brew or owner returns HTTP 409 with
   `Entry ID is already in use`.

Existing callers may omit `client_entry_id`; PostgreSQL continues generating
the entry UUID exactly as before.

This design reuses the existing UUID primary key and requires no database
migration. It does not provide offline update/delete conflict resolution; those
operations need explicit revision semantics if they are added later.

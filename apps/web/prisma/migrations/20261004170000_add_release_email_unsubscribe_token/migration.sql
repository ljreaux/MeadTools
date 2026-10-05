-- This is additive because the preferences table was already deployed on preview.
-- Each existing preference gets an opaque, unique 256-bit token.
ALTER TABLE "release_email_preferences"
  ADD COLUMN "unsubscribe_token" VARCHAR(64);

UPDATE "release_email_preferences"
SET "unsubscribe_token" =
  replace(gen_random_uuid()::text, '-', '') ||
  replace(gen_random_uuid()::text, '-', '');

ALTER TABLE "release_email_preferences"
  ALTER COLUMN "unsubscribe_token" SET NOT NULL;

CREATE UNIQUE INDEX "release_email_preferences_unsubscribe_token_key"
  ON "release_email_preferences"("unsubscribe_token");

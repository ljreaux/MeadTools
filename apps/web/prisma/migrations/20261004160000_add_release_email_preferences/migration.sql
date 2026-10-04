-- Release announcements require explicit, product-specific consent.
-- Existing users have no row and therefore are opted out until they choose.
CREATE TABLE "release_email_preferences" (
  "user_id" INTEGER NOT NULL,
  "prompted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "web_opted_in_at" TIMESTAMPTZ(6),
  "mobile_opted_in_at" TIMESTAMPTZ(6),
  "chat_opted_in_at" TIMESTAMPTZ(6),
  "api_opted_in_at" TIMESTAMPTZ(6),
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "release_email_preferences_pkey" PRIMARY KEY ("user_id")
);

ALTER TABLE "release_email_preferences"
  ADD CONSTRAINT "release_email_preferences_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

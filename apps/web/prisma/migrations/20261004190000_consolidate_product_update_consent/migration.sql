-- Preserve the existing answer: any selected product becomes the single opt-in;
-- an existing all-off row remains an explicit decline. No row remains unasked.
ALTER TABLE "users"
  ADD COLUMN "product_updates_opt_in" BOOLEAN,
  ADD COLUMN "product_updates_last_emailed_date" DATE;

UPDATE "users" AS u
SET "product_updates_opt_in" = (
  p."web_opted_in_at" IS NOT NULL OR
  p."mobile_opted_in_at" IS NOT NULL OR
  p."chat_opted_in_at" IS NOT NULL OR
  p."api_opted_in_at" IS NOT NULL
)
FROM "release_email_preferences" AS p
WHERE p."user_id" = u."id";

DROP TABLE "release_email_preferences";

-- The delivery table was created by a preview PR build. Keep that applied
-- migration immutable, then retire the unused table in this forward migration.
DROP TABLE IF EXISTS "release_email_deliveries";
DROP TYPE IF EXISTS "release_email_delivery_status";
DROP TYPE IF EXISTS "release_email_product";

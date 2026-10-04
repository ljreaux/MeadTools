CREATE TYPE "release_email_product" AS ENUM ('WEB', 'MOBILE', 'CHAT', 'API');
CREATE TYPE "release_email_delivery_status" AS ENUM ('PENDING', 'SENDING', 'SENT', 'FAILED', 'SKIPPED');

CREATE TABLE "release_email_deliveries" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "release_date" DATE NOT NULL,
  "product" "release_email_product" NOT NULL,
  "user_id" INTEGER NOT NULL,
  "status" "release_email_delivery_status" NOT NULL DEFAULT 'PENDING',
  "prepared_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "claimed_at" TIMESTAMPTZ(6),
  "sent_at" TIMESTAMPTZ(6),
  "message_id" VARCHAR(255),
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "release_email_deliveries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "release_email_deliveries_release_date_product_user_id_key"
  ON "release_email_deliveries"("release_date", "product", "user_id");
CREATE INDEX "release_email_deliveries_release_date_product_status_idx"
  ON "release_email_deliveries"("release_date", "product", "status");
CREATE INDEX "release_email_deliveries_claimed_at_idx"
  ON "release_email_deliveries"("claimed_at");

ALTER TABLE "release_email_deliveries"
  ADD CONSTRAINT "release_email_deliveries_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

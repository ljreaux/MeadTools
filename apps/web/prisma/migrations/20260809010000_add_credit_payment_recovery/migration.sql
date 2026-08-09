ALTER TYPE "credit_checkout_session_status" ADD VALUE IF NOT EXISTS 'refunded';

CREATE TYPE "credit_payment_recovery_kind" AS ENUM ('stripe_refund', 'stripe_dispute');
CREATE TYPE "credit_payment_recovery_status" AS ENUM ('applied', 'review_required', 'resolved');

ALTER TABLE "credit_accounts"
  ADD COLUMN "payment_restricted_at" TIMESTAMPTZ(6),
  ADD COLUMN "payment_restriction_reason" VARCHAR(255),
  ADD COLUMN "payment_restriction_reference" VARCHAR(255);

ALTER TABLE "credit_checkout_sessions"
  ADD COLUMN "stripe_amount_total_cents" INTEGER,
  ADD COLUMN "stripe_payment_currency" VARCHAR(3),
  ADD COLUMN "refunded_amount_cents" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "refunded_at" TIMESTAMPTZ(6),
  ADD CONSTRAINT "credit_checkout_sessions_nonnegative_refunded_amount"
    CHECK ("refunded_amount_cents" >= 0),
  ADD CONSTRAINT "credit_checkout_sessions_stripe_currency_length"
    CHECK ("stripe_payment_currency" IS NULL OR char_length("stripe_payment_currency") = 3);

CREATE TABLE "credit_payment_recoveries" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "checkout_id" UUID NOT NULL,
  "recovery_kind" "credit_payment_recovery_kind" NOT NULL,
  "status" "credit_payment_recovery_status" NOT NULL,
  "external_reference" VARCHAR(255) NOT NULL,
  "amount_cents" INTEGER NOT NULL,
  "currency" VARCHAR(3) NOT NULL,
  "credit_delta" INTEGER,
  "resolution_credit_delta" INTEGER,
  "resolution_note" TEXT,
  "resolved_at" TIMESTAMPTZ(6),
  "resolved_by_user_id" INTEGER,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "credit_payment_recoveries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "credit_payment_recoveries_nonnegative_amount" CHECK ("amount_cents" >= 0),
  CONSTRAINT "credit_payment_recoveries_currency_length" CHECK (char_length("currency") = 3)
);

CREATE INDEX "credit_accounts_payment_restricted_at_idx"
  ON "credit_accounts"("payment_restricted_at");
CREATE UNIQUE INDEX "credit_payment_recoveries_external_reference_key"
  ON "credit_payment_recoveries"("external_reference");
CREATE INDEX "credit_payment_recoveries_status_created_at_idx"
  ON "credit_payment_recoveries"("status", "created_at");
CREATE INDEX "credit_payment_recoveries_checkout_id_idx"
  ON "credit_payment_recoveries"("checkout_id");

ALTER TABLE "credit_payment_recoveries"
  ADD CONSTRAINT "credit_payment_recoveries_checkout_id_fkey"
  FOREIGN KEY ("checkout_id") REFERENCES "credit_checkout_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "credit_payment_recoveries"
  ADD CONSTRAINT "credit_payment_recoveries_resolved_by_user_id_fkey"
  FOREIGN KEY ("resolved_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

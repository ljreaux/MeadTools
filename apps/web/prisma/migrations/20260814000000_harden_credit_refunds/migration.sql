-- Refunds revoke prepaid credits, so their immutable ledger entries must be
-- negative. Existing production rows remain valid because this only changes
-- the allowed direction for future refund entries.
ALTER TABLE "credit_ledger_entries"
  DROP CONSTRAINT "credit_ledger_entries_expected_delta_direction";

ALTER TABLE "credit_ledger_entries"
  ADD CONSTRAINT "credit_ledger_entries_expected_delta_direction"
  CHECK (
    ("entry_type" = 'reservation' AND "credits_delta" <= 0) OR
    ("entry_type" IN ('purchase', 'grant', 'settlement', 'reversal') AND "credits_delta" >= 0) OR
    ("entry_type" = 'refund' AND "credits_delta" < 0) OR
    "entry_type" = 'adjustment'
  );

CREATE TYPE "credit_stripe_refund_event_status" AS ENUM ('deferred', 'processed');

CREATE TABLE "credit_stripe_refund_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "external_event_id" VARCHAR(255) NOT NULL,
  "event_type" VARCHAR(128) NOT NULL,
  "stripe_refund_id" VARCHAR(255) NOT NULL,
  "stripe_payment_intent_id" VARCHAR(255) NOT NULL,
  "amount_cents" INTEGER NOT NULL,
  "currency" VARCHAR(3) NOT NULL,
  "status" "credit_stripe_refund_event_status" NOT NULL DEFAULT 'deferred',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processed_at" TIMESTAMPTZ(6),

  CONSTRAINT "credit_stripe_refund_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "credit_stripe_refund_events_nonnegative_amount" CHECK ("amount_cents" >= 0),
  CONSTRAINT "credit_stripe_refund_events_currency_length" CHECK (char_length("currency") = 3)
);

CREATE UNIQUE INDEX "credit_stripe_refund_events_external_event_id_key"
  ON "credit_stripe_refund_events"("external_event_id");
CREATE INDEX "credit_stripe_refund_events_payment_intent_status_idx"
  ON "credit_stripe_refund_events"("stripe_payment_intent_id", "status");
CREATE INDEX "credit_stripe_refund_events_refund_id_idx"
  ON "credit_stripe_refund_events"("stripe_refund_id");

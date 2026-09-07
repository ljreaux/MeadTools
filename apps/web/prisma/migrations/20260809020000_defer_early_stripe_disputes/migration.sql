CREATE TYPE "credit_stripe_dispute_event_status" AS ENUM ('deferred', 'processed');

CREATE TABLE "credit_stripe_dispute_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "external_event_id" VARCHAR(255) NOT NULL,
  "event_type" VARCHAR(128) NOT NULL,
  "stripe_dispute_id" VARCHAR(255) NOT NULL,
  "stripe_payment_intent_id" VARCHAR(255) NOT NULL,
  "amount_cents" INTEGER NOT NULL,
  "currency" VARCHAR(3) NOT NULL,
  "status" "credit_stripe_dispute_event_status" NOT NULL DEFAULT 'deferred',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processed_at" TIMESTAMPTZ(6),

  CONSTRAINT "credit_stripe_dispute_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "credit_stripe_dispute_events_nonnegative_amount" CHECK ("amount_cents" >= 0),
  CONSTRAINT "credit_stripe_dispute_events_currency_length" CHECK (char_length("currency") = 3)
);

CREATE UNIQUE INDEX "credit_stripe_dispute_events_external_event_id_key"
  ON "credit_stripe_dispute_events"("external_event_id");
CREATE INDEX "credit_stripe_dispute_events_payment_intent_status_idx"
  ON "credit_stripe_dispute_events"("stripe_payment_intent_id", "status");
CREATE INDEX "credit_stripe_dispute_events_dispute_id_idx"
  ON "credit_stripe_dispute_events"("stripe_dispute_id");

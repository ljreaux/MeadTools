CREATE TYPE "credit_checkout_session_status" AS ENUM ('pending', 'fulfilled', 'failed', 'expired');

CREATE TABLE "credit_checkout_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" INTEGER NOT NULL,
    "pack_id" VARCHAR(64) NOT NULL,
    "credit_amount" INTEGER NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "stripe_checkout_session_id" VARCHAR(255),
    "stripe_payment_intent_id" VARCHAR(255),
    "status" "credit_checkout_session_status" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fulfilled_at" TIMESTAMPTZ(6),

    CONSTRAINT "credit_checkout_sessions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "credit_checkout_sessions_positive_credits" CHECK ("credit_amount" > 0),
    CONSTRAINT "credit_checkout_sessions_nonnegative_amount" CHECK ("amount_cents" >= 0),
    CONSTRAINT "credit_checkout_sessions_currency_length" CHECK (char_length("currency") = 3)
);

CREATE TABLE "credit_payment_webhook_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "provider" VARCHAR(32) NOT NULL,
    "external_event_id" VARCHAR(255) NOT NULL,
    "event_type" VARCHAR(128) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_payment_webhook_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "credit_checkout_sessions_stripe_checkout_session_id_key"
  ON "credit_checkout_sessions"("stripe_checkout_session_id");
CREATE UNIQUE INDEX "credit_checkout_sessions_stripe_payment_intent_id_key"
  ON "credit_checkout_sessions"("stripe_payment_intent_id");
CREATE INDEX "credit_checkout_sessions_user_id_status_created_at_idx"
  ON "credit_checkout_sessions"("user_id", "status", "created_at");
CREATE UNIQUE INDEX "credit_payment_webhook_events_external_event_id_key"
  ON "credit_payment_webhook_events"("external_event_id");

ALTER TABLE "credit_checkout_sessions"
  ADD CONSTRAINT "credit_checkout_sessions_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

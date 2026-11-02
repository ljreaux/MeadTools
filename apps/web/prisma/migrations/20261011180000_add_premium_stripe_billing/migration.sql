CREATE TABLE "premium_stripe_subscriptions" (
    "user_id" INTEGER NOT NULL,
    "customer_id" VARCHAR(255) NOT NULL,
    "subscription_id" VARCHAR(255) NOT NULL,
    "status" VARCHAR(32) NOT NULL,
    "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "premium_stripe_subscriptions_pkey" PRIMARY KEY ("user_id")
);

CREATE UNIQUE INDEX "premium_stripe_subscriptions_customer_id_key"
    ON "premium_stripe_subscriptions"("customer_id");
CREATE UNIQUE INDEX "premium_stripe_subscriptions_subscription_id_key"
    ON "premium_stripe_subscriptions"("subscription_id");
ALTER TABLE "premium_stripe_subscriptions" ADD CONSTRAINT "premium_stripe_subscriptions_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "premium_stripe_invoices" (
    "invoice_id" VARCHAR(255) NOT NULL,
    "user_id" INTEGER NOT NULL,
    "subscription_id" VARCHAR(255) NOT NULL,
    "paid_at" TIMESTAMPTZ(6) NOT NULL,
    "paid_through" TIMESTAMPTZ(6) NOT NULL,
    "amount_paid_cents" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "premium_stripe_invoices_pkey" PRIMARY KEY ("invoice_id")
);

CREATE INDEX "premium_stripe_invoices_user_id_paid_at_idx"
    ON "premium_stripe_invoices"("user_id", "paid_at");
CREATE INDEX "premium_stripe_invoices_subscription_id_paid_at_idx"
    ON "premium_stripe_invoices"("subscription_id", "paid_at");
ALTER TABLE "premium_stripe_invoices" ADD CONSTRAINT "premium_stripe_invoices_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

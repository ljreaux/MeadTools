CREATE TABLE "mcp_oauth_consumed_refresh_tokens" (
  "token_hash" VARCHAR(64) NOT NULL PRIMARY KEY,
  "session_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "mcp_oauth_consumed_refresh_tokens_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "mcp_oauth_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "mcp_oauth_consumed_refresh_tokens_session_id_idx" ON "mcp_oauth_consumed_refresh_tokens"("session_id");
CREATE TABLE "mcp_registration_budget" (
  "id" BOOLEAN NOT NULL DEFAULT true PRIMARY KEY,
  "window_start" TIMESTAMPTZ(6) NOT NULL,
  "call_count" INTEGER NOT NULL,
  CONSTRAINT "mcp_registration_budget_singleton" CHECK ("id" = true)
);
ALTER TABLE "premium_stripe_invoices" ADD COLUMN "refunded_amount_cents" INTEGER NOT NULL DEFAULT 0;
CREATE TABLE "premium_stripe_payments" (
  "payment_intent_id" VARCHAR(255) NOT NULL PRIMARY KEY,
  "invoice_id" VARCHAR(255) NOT NULL,
  CONSTRAINT "premium_stripe_payments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "premium_stripe_invoices"("invoice_id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "premium_stripe_payments_invoice_id_idx" ON "premium_stripe_payments"("invoice_id");
ALTER TABLE "credit_payment_recoveries" ALTER COLUMN "checkout_id" DROP NOT NULL;
ALTER TABLE "credit_payment_recoveries" ADD COLUMN "premium_invoice_id" VARCHAR(255);
ALTER TABLE "credit_payment_recoveries" ADD CONSTRAINT "credit_payment_recoveries_premium_invoice_id_fkey" FOREIGN KEY ("premium_invoice_id") REFERENCES "premium_stripe_invoices"("invoice_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "credit_payment_recoveries" ADD CONSTRAINT "credit_payment_recoveries_one_source" CHECK (("checkout_id" IS NOT NULL)::integer + ("premium_invoice_id" IS NOT NULL)::integer = 1);
CREATE INDEX "credit_payment_recoveries_premium_invoice_id_idx" ON "credit_payment_recoveries"("premium_invoice_id");

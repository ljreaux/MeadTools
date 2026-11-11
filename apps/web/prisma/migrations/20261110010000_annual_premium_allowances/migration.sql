ALTER TABLE "premium_stripe_subscriptions" ADD COLUMN "scheduled_interval" VARCHAR(8)
  CHECK ("scheduled_interval" IS NULL OR "scheduled_interval" IN ('month', 'year'));

ALTER TABLE "premium_stripe_invoices"
  ADD COLUMN "billing_interval" VARCHAR(8) NOT NULL DEFAULT 'month',
  ADD COLUMN "granted_credits" INTEGER NOT NULL DEFAULT 1000,
  ADD COLUMN "allowances_stopped_at" TIMESTAMPTZ(6),
  ADD CONSTRAINT "premium_invoice_interval_check" CHECK ("billing_interval" IN ('month', 'year')),
  ADD CONSTRAINT "premium_invoice_granted_credits_check" CHECK ("granted_credits" BETWEEN 0 AND 12000);

CREATE TABLE "premium_stripe_allowances" (
  "invoice_id" VARCHAR(255) NOT NULL,
  "allowance_index" INTEGER NOT NULL CHECK ("allowance_index" BETWEEN 0 AND 11),
  "due_at" TIMESTAMPTZ(6) NOT NULL,
  "granted_at" TIMESTAMPTZ(6),
  CONSTRAINT "premium_stripe_allowances_pkey" PRIMARY KEY ("invoice_id", "allowance_index"),
  CONSTRAINT "premium_stripe_allowances_invoice_id_fkey" FOREIGN KEY ("invoice_id")
    REFERENCES "premium_stripe_invoices"("invoice_id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "premium_stripe_allowances_granted_at_due_at_idx"
  ON "premium_stripe_allowances"("granted_at", "due_at");

-- The application uses ownership-checked Prisma access, never direct Data API access.
ALTER TABLE "premium_stripe_allowances" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "premium_stripe_allowances" FROM PUBLIC;
DO $$
DECLARE api_role text;
BEGIN
  FOR api_role IN SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated')
  LOOP
    EXECUTE format('REVOKE ALL ON TABLE public.premium_stripe_allowances FROM %I', api_role);
  END LOOP;
END $$;

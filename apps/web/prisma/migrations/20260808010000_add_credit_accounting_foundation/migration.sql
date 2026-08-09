CREATE TYPE "credit_ledger_entry_type" AS ENUM (
    'purchase',
    'grant',
    'reservation',
    'settlement',
    'reversal',
    'refund',
    'adjustment'
);

CREATE TABLE "credit_accounts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_accounts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "credit_pricing_versions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "provider" VARCHAR(64) NOT NULL,
    "model" VARCHAR(255) NOT NULL,
    "version" VARCHAR(96) NOT NULL,
    "uncached_input_picousd_per_million_tokens" BIGINT NOT NULL,
    "cached_input_picousd_per_million_tokens" BIGINT NOT NULL,
    "output_picousd_per_million_tokens" BIGINT NOT NULL,
    "effective_at" TIMESTAMPTZ(6) NOT NULL,
    "retired_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_pricing_versions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "credit_pricing_versions_nonnegative_rates"
      CHECK (
        "uncached_input_picousd_per_million_tokens" >= 0 AND
        "cached_input_picousd_per_million_tokens" >= 0 AND
        "output_picousd_per_million_tokens" >= 0
      )
);

CREATE TABLE "credit_fee_policy_versions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "version" VARCHAR(96) NOT NULL,
    "markup_basis_points" INTEGER NOT NULL,
    "fixed_turn_credits" INTEGER NOT NULL DEFAULT 0,
    "minimum_turn_credits" INTEGER NOT NULL DEFAULT 1,
    "effective_at" TIMESTAMPTZ(6) NOT NULL,
    "retired_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_fee_policy_versions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "credit_fee_policy_versions_nonnegative_values"
      CHECK (
        "markup_basis_points" >= 0 AND
        "fixed_turn_credits" >= 0 AND
        "minimum_turn_credits" >= 0
      )
);

CREATE TABLE "credit_ledger_entries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "account_id" UUID NOT NULL,
    "operation_id" UUID NOT NULL,
    "idempotency_key" VARCHAR(128) NOT NULL,
    "entry_type" "credit_ledger_entry_type" NOT NULL,
    "credits_delta" INTEGER NOT NULL,
    "pricing_version_id" UUID,
    "fee_policy_version_id" UUID,
    "provider_cost_picousd" BIGINT,
    "source_amount_cents" INTEGER,
    "source_currency" VARCHAR(3),
    "external_reference" VARCHAR(255),
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_ledger_entries_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "credit_ledger_entries_expected_delta_direction"
      CHECK (
        ("entry_type" = 'reservation' AND "credits_delta" <= 0) OR
        ("entry_type" IN ('purchase', 'grant', 'settlement', 'reversal', 'refund') AND "credits_delta" >= 0) OR
        "entry_type" = 'adjustment'
      ),
    CONSTRAINT "credit_ledger_entries_nonnegative_provider_cost"
      CHECK ("provider_cost_picousd" IS NULL OR "provider_cost_picousd" >= 0),
    CONSTRAINT "credit_ledger_entries_nonnegative_source_amount"
      CHECK ("source_amount_cents" IS NULL OR "source_amount_cents" >= 0),
    CONSTRAINT "credit_ledger_entries_currency_length"
      CHECK ("source_currency" IS NULL OR char_length("source_currency") = 3)
);

CREATE UNIQUE INDEX "credit_accounts_user_id_key" ON "credit_accounts"("user_id");
CREATE UNIQUE INDEX "credit_pricing_versions_provider_model_version_key"
  ON "credit_pricing_versions"("provider", "model", "version");
CREATE INDEX "credit_pricing_versions_provider_model_effective_at_idx"
  ON "credit_pricing_versions"("provider", "model", "effective_at");
CREATE UNIQUE INDEX "credit_fee_policy_versions_version_key"
  ON "credit_fee_policy_versions"("version");
CREATE INDEX "credit_fee_policy_versions_effective_at_idx"
  ON "credit_fee_policy_versions"("effective_at");
CREATE UNIQUE INDEX "credit_ledger_entries_account_id_idempotency_key_key"
  ON "credit_ledger_entries"("account_id", "idempotency_key");
CREATE UNIQUE INDEX "credit_ledger_entries_account_id_operation_id_entry_type_key"
  ON "credit_ledger_entries"("account_id", "operation_id", "entry_type");
CREATE INDEX "credit_ledger_entries_account_id_created_at_idx"
  ON "credit_ledger_entries"("account_id", "created_at");
CREATE INDEX "credit_ledger_entries_operation_id_idx"
  ON "credit_ledger_entries"("operation_id");
CREATE INDEX "credit_ledger_entries_external_reference_idx"
  ON "credit_ledger_entries"("external_reference");

ALTER TABLE "credit_accounts"
  ADD CONSTRAINT "credit_accounts_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "credit_ledger_entries"
  ADD CONSTRAINT "credit_ledger_entries_account_id_fkey"
  FOREIGN KEY ("account_id") REFERENCES "credit_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "credit_ledger_entries"
  ADD CONSTRAINT "credit_ledger_entries_pricing_version_id_fkey"
  FOREIGN KEY ("pricing_version_id") REFERENCES "credit_pricing_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "credit_ledger_entries"
  ADD CONSTRAINT "credit_ledger_entries_fee_policy_version_id_fkey"
  FOREIGN KEY ("fee_policy_version_id") REFERENCES "credit_fee_policy_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION prevent_credit_ledger_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'credit ledger entries are immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "credit_ledger_entries_immutable"
BEFORE UPDATE OR DELETE ON "credit_ledger_entries"
FOR EACH ROW EXECUTE FUNCTION prevent_credit_ledger_mutation();

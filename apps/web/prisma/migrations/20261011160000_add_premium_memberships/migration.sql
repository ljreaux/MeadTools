CREATE TABLE "premium_memberships" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" INTEGER NOT NULL,
    "source" VARCHAR(32) NOT NULL,
    "external_reference" VARCHAR(255),
    "paid_through" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "premium_memberships_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "premium_memberships_user_id_source_key" ON "premium_memberships"("user_id", "source");
CREATE UNIQUE INDEX "premium_memberships_source_external_reference_key" ON "premium_memberships"("source", "external_reference");
CREATE INDEX "premium_memberships_user_id_paid_through_idx" ON "premium_memberships"("user_id", "paid_through");

ALTER TABLE "premium_memberships" ADD CONSTRAINT "premium_memberships_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "premium_kofi_links" (
    "user_id" INTEGER NOT NULL,
    "email_digest" VARCHAR(64) NOT NULL,
    "grandfathered" BOOLEAN NOT NULL DEFAULT true,
    "verified_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "premium_kofi_links_pkey" PRIMARY KEY ("user_id")
);
CREATE UNIQUE INDEX "premium_kofi_links_email_digest_key" ON "premium_kofi_links"("email_digest");
ALTER TABLE "premium_kofi_links" ADD CONSTRAINT "premium_kofi_links_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "premium_kofi_link_challenges" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" INTEGER NOT NULL,
    "email_digest" VARCHAR(64) NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "consumed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "premium_kofi_link_challenges_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "premium_kofi_link_challenges_token_hash_key" ON "premium_kofi_link_challenges"("token_hash");
CREATE INDEX "premium_kofi_link_challenges_user_id_expires_at_idx" ON "premium_kofi_link_challenges"("user_id", "expires_at");
ALTER TABLE "premium_kofi_link_challenges" ADD CONSTRAINT "premium_kofi_link_challenges_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "premium_kofi_payments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "message_id" VARCHAR(128) NOT NULL,
    "transaction_id" VARCHAR(128) NOT NULL,
    "email_digest" VARCHAR(64) NOT NULL,
    "paid_at" TIMESTAMPTZ(6) NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "applied_user_id" INTEGER,
    "applied_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "premium_kofi_payments_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "premium_kofi_payments_message_id_key" ON "premium_kofi_payments"("message_id");
CREATE UNIQUE INDEX "premium_kofi_payments_transaction_id_key" ON "premium_kofi_payments"("transaction_id");
CREATE INDEX "premium_kofi_payments_email_digest_paid_at_idx" ON "premium_kofi_payments"("email_digest", "paid_at");

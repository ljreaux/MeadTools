CREATE TABLE "premium_stripe_checkouts" (
    "user_id" INTEGER NOT NULL,
    "attempt_id" UUID NOT NULL,
    "params" JSONB NOT NULL,
    "session_id" VARCHAR(255),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "premium_stripe_checkouts_pkey" PRIMARY KEY ("user_id"),
    CONSTRAINT "premium_stripe_checkouts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "premium_stripe_checkouts_attempt_id_key" ON "premium_stripe_checkouts"("attempt_id");
CREATE UNIQUE INDEX "premium_stripe_checkouts_session_id_key" ON "premium_stripe_checkouts"("session_id");

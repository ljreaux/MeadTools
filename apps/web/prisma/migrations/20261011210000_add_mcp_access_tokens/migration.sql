CREATE TABLE "mcp_access_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" INTEGER NOT NULL,
    "label" VARCHAR(80) NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "last_used_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "mcp_access_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "mcp_access_tokens_token_hash_key" ON "mcp_access_tokens"("token_hash");
CREATE INDEX "mcp_access_tokens_user_id_revoked_at_idx" ON "mcp_access_tokens"("user_id", "revoked_at");
ALTER TABLE "mcp_access_tokens" ADD CONSTRAINT "mcp_access_tokens_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

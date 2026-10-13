CREATE TABLE "mcp_oauth_clients" (
    "client_id" VARCHAR(128) NOT NULL,
    "client_name" VARCHAR(100) NOT NULL,
    "redirect_uris" TEXT[] NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "mcp_oauth_clients_pkey" PRIMARY KEY ("client_id")
);

CREATE TABLE "mcp_oauth_codes" (
    "code_hash" VARCHAR(64) NOT NULL,
    "consent_hash" VARCHAR(64) NOT NULL,
    "user_id" INTEGER NOT NULL,
    "client_id" VARCHAR(128) NOT NULL,
    "redirect_uri" VARCHAR(2048) NOT NULL,
    "code_challenge" VARCHAR(128) NOT NULL,
    "resource" VARCHAR(512) NOT NULL,
    "scope" VARCHAR(128) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "consumed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "mcp_oauth_codes_pkey" PRIMARY KEY ("code_hash")
);
CREATE UNIQUE INDEX "mcp_oauth_codes_consent_hash_key" ON "mcp_oauth_codes"("consent_hash");
CREATE INDEX "mcp_oauth_codes_user_id_expires_at_idx" ON "mcp_oauth_codes"("user_id", "expires_at");
ALTER TABLE "mcp_oauth_codes" ADD CONSTRAINT "mcp_oauth_codes_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "mcp_oauth_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" INTEGER NOT NULL,
    "client_id" VARCHAR(128) NOT NULL,
    "label" VARCHAR(100) NOT NULL,
    "access_token_hash" VARCHAR(64) NOT NULL,
    "refresh_token_hash" VARCHAR(64) NOT NULL,
    "resource" VARCHAR(512) NOT NULL,
    "scope" VARCHAR(128) NOT NULL,
    "access_expires_at" TIMESTAMPTZ(6) NOT NULL,
    "refresh_expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "last_used_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "mcp_oauth_sessions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "mcp_oauth_sessions_access_token_hash_key" ON "mcp_oauth_sessions"("access_token_hash");
CREATE UNIQUE INDEX "mcp_oauth_sessions_refresh_token_hash_key" ON "mcp_oauth_sessions"("refresh_token_hash");
CREATE INDEX "mcp_oauth_sessions_user_id_revoked_at_idx" ON "mcp_oauth_sessions"("user_id", "revoked_at");
ALTER TABLE "mcp_oauth_sessions" ADD CONSTRAINT "mcp_oauth_sessions_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

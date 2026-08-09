CREATE TYPE "chat_access_mode" AS ENUM ('beta_allowlist', 'all_active_users');

CREATE TABLE "chat_access_settings" (
    "id" BOOLEAN NOT NULL DEFAULT true,
    "mode" "chat_access_mode" NOT NULL DEFAULT 'beta_allowlist',
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_by_user_id" INTEGER,

    CONSTRAINT "chat_access_settings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "chat_access_settings_singleton" CHECK ("id" = true)
);

CREATE TABLE "chat_access_grants" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" INTEGER NOT NULL,
    "granted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "granted_by_user_id" INTEGER NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),

    CONSTRAINT "chat_access_grants_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "chat_access_grants_user_id_key" ON "chat_access_grants"("user_id");
CREATE INDEX "chat_access_grants_revoked_at_idx" ON "chat_access_grants"("revoked_at");

ALTER TABLE "chat_access_settings"
  ADD CONSTRAINT "chat_access_settings_updated_by_user_id_fkey"
  FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "chat_access_grants"
  ADD CONSTRAINT "chat_access_grants_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

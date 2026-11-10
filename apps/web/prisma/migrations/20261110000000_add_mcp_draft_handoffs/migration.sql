CREATE TABLE "mcp_draft_handoffs" (
    "id" UUID NOT NULL,
    "user_id" INTEGER NOT NULL,
    "payload" VARCHAR(24000) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "mcp_draft_handoffs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "mcp_draft_handoffs_user_id_fkey"
        FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "mcp_draft_handoffs_expires_at_idx" ON "mcp_draft_handoffs"("expires_at");
CREATE INDEX "mcp_draft_handoffs_user_id_idx" ON "mcp_draft_handoffs"("user_id");

-- The website authorizes owner-only reads through Prisma.
ALTER TABLE "mcp_draft_handoffs" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "mcp_draft_handoffs" FROM PUBLIC;
DO $$
DECLARE
  api_role text;
BEGIN
  FOR api_role IN SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated')
  LOOP
    EXECUTE format('REVOKE ALL ON TABLE public.mcp_draft_handoffs FROM %I', api_role);
  END LOOP;
END $$;

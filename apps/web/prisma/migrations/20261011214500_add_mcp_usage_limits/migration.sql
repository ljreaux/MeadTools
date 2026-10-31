CREATE TABLE "mcp_rate_buckets" (
    "user_id" INTEGER NOT NULL,
    "window_start" TIMESTAMPTZ(6) NOT NULL,
    "call_count" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "mcp_rate_buckets_pkey" PRIMARY KEY ("user_id")
);
ALTER TABLE "mcp_rate_buckets" ADD CONSTRAINT "mcp_rate_buckets_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "mcp_tool_leases" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" INTEGER NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "mcp_tool_leases_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "mcp_tool_leases_user_id_expires_at_idx" ON "mcp_tool_leases"("user_id", "expires_at");
ALTER TABLE "mcp_tool_leases" ADD CONSTRAINT "mcp_tool_leases_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "mcp_tool_usage" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" INTEGER NOT NULL,
    "tool_name" VARCHAR(80) NOT NULL,
    "result_class" VARCHAR(40) NOT NULL,
    "duration_ms" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "mcp_tool_usage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "mcp_tool_usage_user_id_created_at_idx" ON "mcp_tool_usage"("user_id", "created_at");
ALTER TABLE "mcp_tool_usage" ADD CONSTRAINT "mcp_tool_usage_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

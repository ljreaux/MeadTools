CREATE TABLE "chatbot_usage_windows" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" INTEGER NOT NULL,
    "window" VARCHAR(8) NOT NULL,
    "window_start" TIMESTAMPTZ(6) NOT NULL,
    "request_count" INTEGER NOT NULL DEFAULT 0,
    "provider_calls" INTEGER NOT NULL DEFAULT 0,
    "input_tokens" INTEGER NOT NULL DEFAULT 0,
    "cached_input_tokens" INTEGER NOT NULL DEFAULT 0,
    "output_tokens" INTEGER NOT NULL DEFAULT 0,
    "total_tokens" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chatbot_usage_windows_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "chatbot_usage_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "request_id" UUID NOT NULL,
    "user_id" INTEGER NOT NULL,
    "environment" VARCHAR(32) NOT NULL,
    "model" VARCHAR(255) NOT NULL,
    "status" VARCHAR(16) NOT NULL,
    "provider_calls" INTEGER NOT NULL DEFAULT 0,
    "input_tokens" INTEGER NOT NULL DEFAULT 0,
    "cached_input_tokens" INTEGER NOT NULL DEFAULT 0,
    "output_tokens" INTEGER NOT NULL DEFAULT 0,
    "total_tokens" INTEGER NOT NULL DEFAULT 0,
    "provider_request_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),

    CONSTRAINT "chatbot_usage_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "chatbot_usage_windows_user_id_window_window_start_key"
  ON "chatbot_usage_windows"("user_id", "window", "window_start");
CREATE INDEX "chatbot_usage_windows_window_window_start_idx"
  ON "chatbot_usage_windows"("window", "window_start");
CREATE UNIQUE INDEX "chatbot_usage_events_request_id_key"
  ON "chatbot_usage_events"("request_id");
CREATE INDEX "chatbot_usage_events_user_id_created_at_idx"
  ON "chatbot_usage_events"("user_id", "created_at");
CREATE INDEX "chatbot_usage_events_environment_created_at_idx"
  ON "chatbot_usage_events"("environment", "created_at");
CREATE INDEX "chatbot_usage_events_status_created_at_idx"
  ON "chatbot_usage_events"("status", "created_at");

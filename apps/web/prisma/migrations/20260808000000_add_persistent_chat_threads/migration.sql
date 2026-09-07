CREATE TYPE "chat_conversation_state" AS ENUM ('active', 'archived');
CREATE TYPE "chat_message_role" AS ENUM ('user', 'assistant');
CREATE TYPE "chat_message_status" AS ENUM ('pending', 'complete', 'failed', 'cancelled');
CREATE TYPE "chat_context_kind" AS ENUM ('recipe', 'brew');

CREATE TABLE "chat_conversations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" INTEGER NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "state" "chat_conversation_state" NOT NULL DEFAULT 'active',
    "next_sequence" INTEGER NOT NULL DEFAULT 1,
    "message_count" INTEGER NOT NULL DEFAULT 0,
    "content_bytes" INTEGER NOT NULL DEFAULT 0,
    "last_activity_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_conversations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "chat_drafts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "conversation_id" UUID NOT NULL,
    "revision" INTEGER NOT NULL,
    "recipe_draft_input" JSONB,
    "recipe_data" JSONB,
    "saved_recipe_id" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_drafts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "chat_messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "conversation_id" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "client_message_id" VARCHAR(128),
    "role" "chat_message_role" NOT NULL,
    "status" "chat_message_status" NOT NULL DEFAULT 'pending',
    "content" TEXT NOT NULL,
    "citations" JSONB,
    "draft_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "chat_generations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "message_id" UUID NOT NULL,
    "usage_event_id" UUID,
    "provider" VARCHAR(64) NOT NULL,
    "model" VARCHAR(255) NOT NULL,
    "status" VARCHAR(16) NOT NULL,
    "latency_ms" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),

    CONSTRAINT "chat_generations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "chat_message_contexts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "message_id" UUID NOT NULL,
    "kind" "chat_context_kind" NOT NULL,
    "record_id" VARCHAR(64) NOT NULL,
    "label" VARCHAR(240) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_message_contexts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "chat_messages_conversation_id_sequence_key"
  ON "chat_messages"("conversation_id", "sequence");
CREATE UNIQUE INDEX "chat_messages_conversation_id_client_message_id_key"
  ON "chat_messages"("conversation_id", "client_message_id");
CREATE UNIQUE INDEX "chat_drafts_conversation_id_revision_key"
  ON "chat_drafts"("conversation_id", "revision");
CREATE UNIQUE INDEX "chat_generations_message_id_key"
  ON "chat_generations"("message_id");
CREATE UNIQUE INDEX "chat_message_contexts_message_id_kind_record_id_key"
  ON "chat_message_contexts"("message_id", "kind", "record_id");

CREATE INDEX "chat_conversations_user_id_state_last_activity_at_idx"
  ON "chat_conversations"("user_id", "state", "last_activity_at");
CREATE INDEX "chat_conversations_expires_at_idx" ON "chat_conversations"("expires_at");
CREATE INDEX "chat_messages_conversation_id_created_at_idx"
  ON "chat_messages"("conversation_id", "created_at");
CREATE INDEX "chat_drafts_conversation_id_created_at_idx"
  ON "chat_drafts"("conversation_id", "created_at");
CREATE INDEX "chat_generations_usage_event_id_idx" ON "chat_generations"("usage_event_id");
CREATE INDEX "chat_generations_provider_model_created_at_idx"
  ON "chat_generations"("provider", "model", "created_at");
CREATE INDEX "chat_message_contexts_record_id_kind_idx"
  ON "chat_message_contexts"("record_id", "kind");

ALTER TABLE "chat_conversations"
  ADD CONSTRAINT "chat_conversations_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "chat_drafts"
  ADD CONSTRAINT "chat_drafts_conversation_id_fkey"
  FOREIGN KEY ("conversation_id") REFERENCES "chat_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "chat_drafts"
  ADD CONSTRAINT "chat_drafts_saved_recipe_id_fkey"
  FOREIGN KEY ("saved_recipe_id") REFERENCES "recipes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "chat_messages"
  ADD CONSTRAINT "chat_messages_conversation_id_fkey"
  FOREIGN KEY ("conversation_id") REFERENCES "chat_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "chat_messages"
  ADD CONSTRAINT "chat_messages_draft_id_fkey"
  FOREIGN KEY ("draft_id") REFERENCES "chat_drafts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "chat_generations"
  ADD CONSTRAINT "chat_generations_message_id_fkey"
  FOREIGN KEY ("message_id") REFERENCES "chat_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "chat_generations"
  ADD CONSTRAINT "chat_generations_usage_event_id_fkey"
  FOREIGN KEY ("usage_event_id") REFERENCES "chatbot_usage_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "chat_message_contexts"
  ADD CONSTRAINT "chat_message_contexts_message_id_fkey"
  FOREIGN KEY ("message_id") REFERENCES "chat_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

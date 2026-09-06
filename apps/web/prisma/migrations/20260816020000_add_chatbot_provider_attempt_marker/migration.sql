-- Each provider dispatch is durable evidence that a zero-token checkpoint must
-- not be treated as proof of zero spend. Compare this count with provider_calls
-- to detect an attempted completion whose usage checkpoint did not persist.
ALTER TABLE "chatbot_usage_events"
  ADD COLUMN "provider_attempt_count" INTEGER NOT NULL DEFAULT 0;

-- The chat operations dashboard filters final ledger activity and provider
-- usage by time. These indexes keep that administrative reporting bounded as
-- ledger and usage history grow.
CREATE INDEX "credit_ledger_entries_entry_type_created_at_idx"
  ON "credit_ledger_entries"("entry_type", "created_at");

CREATE INDEX "chatbot_usage_events_created_at_status_idx"
  ON "chatbot_usage_events"("created_at", "status");

CREATE INDEX "chatbot_usage_events_model_created_at_idx"
  ON "chatbot_usage_events"("model", "created_at");

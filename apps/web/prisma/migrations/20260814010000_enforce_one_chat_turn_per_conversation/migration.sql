-- The transaction-level check in appendPendingChatMessage gives a friendly
-- conflict response; this partial unique index is the database backstop that
-- prevents two provider histories from diverging through any future caller.
CREATE UNIQUE INDEX "chat_messages_one_pending_user_turn_per_conversation"
  ON "chat_messages" ("conversation_id")
  WHERE "role" = 'user' AND "status" = 'pending';

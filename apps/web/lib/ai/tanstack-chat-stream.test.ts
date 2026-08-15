import assert from "node:assert/strict";
import test from "node:test";
import { EventType } from "@tanstack/ai/client";
import { streamRecipeChatTurn } from "./tanstack-chat-stream";
import { ChatProviderRequestError } from "./chat-model";

test("adapts a recipe turn to the TanStack AG-UI event stream", async () => {
  const chunks = [];
  for await (const chunk of streamRecipeChatTurn({
    model: "accounts/fireworks/models/test",
    runId: "run-1",
    threadId: "thread-1",
    run: async (onEvent) => {
      onEvent({ type: "tool_call", toolName: "search_ingredients" });
      onEvent({ type: "tool_result", toolName: "search_ingredients", status: "ok" });
      return {
        answer: "A concise recipe answer.",
        toolResults: [{ toolName: "search_ingredients", result: { status: "ok" } }],
        usage: {
          provider: "fireworks",
          model: "accounts/fireworks/models/test",
          inputTokens: 25,
          outputTokens: 10,
          totalTokens: 35,
          cachedInputTokens: 0,
          requestIds: [],
          toolCalls: 1,
          latencyMs: 10
        }
      };
    }
  })) {
    chunks.push(chunk);
  }

  assert.equal(chunks[0]?.type, EventType.RUN_STARTED);
  assert.deepEqual(
    chunks
      .filter((chunk) => chunk.type === EventType.CUSTOM)
      .map((chunk) => "name" in chunk ? chunk.name : undefined),
    ["recipe.tool", "recipe.tool", "recipe.turn"]
  );
  assert.equal(
    chunks
      .filter((chunk) => chunk.type === EventType.TEXT_MESSAGE_CONTENT)
      .map((chunk) => "delta" in chunk ? chunk.delta : "")
      .join(""),
    "A concise recipe answer."
  );
  assert.equal(chunks.at(-1)?.type, EventType.RUN_FINISHED);
});

test("keeps provider transport details out of a streamed chat error", async () => {
  const chunks = [];
  for await (const chunk of streamRecipeChatTurn({
    model: "gpt-5.4-mini-2026-03-17",
    runId: "run-2",
    threadId: "thread-2",
    run: async () => {
      throw new ChatProviderRequestError("openai", 503);
    }
  })) {
    chunks.push(chunk);
  }

  const error = chunks.at(-1);
  assert.equal(error?.type, EventType.RUN_ERROR);
  assert.equal(
    "message" in (error ?? {}) ? error.message : undefined,
    "The recipe assistant is temporarily unavailable. Your credits were not used; please try again."
  );
});

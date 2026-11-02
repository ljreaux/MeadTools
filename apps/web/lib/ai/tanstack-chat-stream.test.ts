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
      onEvent({
        type: "tool_result",
        toolName: "search_ingredients",
        status: "ok",
      });
      return {
        answer: "A concise recipe answer.",
        toolResults: [
          { toolName: "search_ingredients", result: { status: "ok" } },
        ],
        usage: {
          provider: "fireworks",
          model: "accounts/fireworks/models/test",
          inputTokens: 25,
          outputTokens: 10,
          totalTokens: 35,
          cachedInputTokens: 0,
          requestIds: [],
          toolCalls: 1,
          latencyMs: 10,
        },
      };
    },
  })) {
    chunks.push(chunk);
  }

  assert.equal(chunks[0]?.type, EventType.RUN_STARTED);
  assert.deepEqual(
    chunks
      .filter((chunk) => chunk.type === EventType.CUSTOM)
      .map((chunk) => ("name" in chunk ? chunk.name : undefined)),
    ["recipe.tool", "recipe.tool", "recipe.turn"],
  );
  assert.equal(
    chunks
      .filter((chunk) => chunk.type === EventType.TEXT_MESSAGE_CONTENT)
      .map((chunk) => ("delta" in chunk ? chunk.delta : ""))
      .join(""),
    "A concise recipe answer.",
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
    },
  })) {
    chunks.push(chunk);
  }

  const error = chunks.at(-1);
  assert.equal(error?.type, EventType.RUN_ERROR);
  assert.equal(
    "message" in (error ?? {}) ? error.message : undefined,
    "The recipe assistant is temporarily unavailable. Your balance may include a temporary hold while we verify this request; please try again later.",
  );
});

test("answer previews reach the client before persistence/title work finishes", async () => {
  let release!: () => void;
  const wait = new Promise<void>(resolve => { release = resolve; });
  const stream = streamRecipeChatTurn({ model: "offline", runId: "live", threadId: "test", run: async onEvent => {
    onEvent({ type: "answer_delta", delta: "Early text" });
    await wait;
    return { answer: "Early text", toolResults: [], usage: { provider: "openai", model: "offline", requestIds: [], inputTokens: 1, cachedInputTokens: 0, outputTokens: 1, totalTokens: 2, toolCalls: 0, latencyMs: 1 } };
  } })[Symbol.asyncIterator]();
  assert.equal((await stream.next()).value.type, EventType.RUN_STARTED);
  const preview = (await stream.next()).value;
  assert.equal(preview.type, EventType.CUSTOM);
  assert.equal(preview.name, "recipe.answer");
  release();
  while (!(await stream.next()).done) { /* finish the local fixture */ }
});

test("specific step details survive the progress transport", async () => {
  const chunks = [];
  for await (const chunk of streamRecipeChatTurn({ model: "offline", runId: "details", threadId: "details", run: async onEvent => {
    onEvent({ type: "tool_call", toolName: "search_yeasts", detail: { subject: "Lalvin EC1118" } });
    onEvent({ type: "tool_result", toolName: "search_yeasts", status: "ok", detail: { subject: "Lalvin EC1118", count: 1 } });
    return { answer: "Found the requested yeast.", toolResults: [], usage: { provider: "openai", model: "offline", requestIds: [], inputTokens: 1, cachedInputTokens: 0, outputTokens: 1, totalTokens: 2, toolCalls: 1, latencyMs: 1 } };
  } })) chunks.push(chunk);
  const result = chunks.find(c => c.type === EventType.CUSTOM && c.name === "recipe.tool" && (c.value as {type:string}).type === "tool_result");
  assert.ok(result?.type === EventType.CUSTOM);
  assert.deepEqual(result.value, { type: "tool_result", toolName: "search_yeasts", status: "ok", detail: { subject: "Lalvin EC1118", count: 1 } });
});

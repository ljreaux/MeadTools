import assert from "node:assert/strict";
import test from "node:test";
import { FireworksChatClient } from "./fireworks";

test("Fireworks client sends a server-side OpenAI-compatible completion request", async () => {
  let request: Request | undefined;
  const client = new FireworksChatClient({
    apiKey: "test-key",
    model: "accounts/fireworks/models/test-model",
    annotations: { project: "chatbot", environment: "preview" },
    fetcher: async (input, init) => {
      request = new Request(input, init);
      return Response.json({
        id: "response-1",
        model: "accounts/fireworks/models/test-model",
        choices: [
          { finish_reason: "stop", message: { role: "assistant", content: "Hello" } }
        ],
        usage: {
          prompt_tokens: 12,
          completion_tokens: 3,
          total_tokens: 15,
          prompt_tokens_details: { cached_tokens: 4 }
        }
      });
    }
  });

  const completion = await client.complete({
    messages: [{ role: "user", content: "Hello" }],
    maxOutputTokens: 300,
    userId: 42
  });

  assert.equal(request?.url, "https://api.fireworks.ai/inference/v1/chat/completions");
  assert.equal(request?.headers.get("authorization"), "Bearer test-key");
  assert.equal(
    request?.headers.get("fireworks-annotations"),
    "team=meadtools,project=chatbot,environment=preview"
  );
  assert.deepEqual(await request?.json(), {
    model: "accounts/fireworks/models/test-model",
    messages: [{ role: "user", content: "Hello" }],
    tool_choice: "auto",
    parallel_tool_calls: false,
    temperature: 0.2,
    max_tokens: 300,
    user: "42"
  });
  assert.deepEqual(completion.usage, {
    inputTokens: 12,
    outputTokens: 3,
    totalTokens: 15,
    cachedInputTokens: 4
  });
  assert.equal(completion.finishReason, "stop");
});

test("Fireworks client retries one transient timeout", async () => {
  let attempts = 0;
  const client = new FireworksChatClient({
    apiKey: "test-key",
    model: "accounts/fireworks/models/test-model",
    fetcher: async () => {
      attempts += 1;
      if (attempts === 1) throw new Error("The operation was aborted due to timeout");
      return Response.json({
        id: "response-2",
        model: "accounts/fireworks/models/test-model",
        choices: [{ finish_reason: "stop", message: { role: "assistant", content: "Recovered" } }]
      });
    }
  });

  const completion = await client.complete({
    messages: [{ role: "user", content: "Hello" }],
    maxOutputTokens: 300,
    userId: 42
  });

  assert.equal(attempts, 2);
  assert.equal(completion.message.content, "Recovered");
});

test("Fireworks client disables reasoning for a compact title request", async () => {
  let request: Request | undefined;
  const client = new FireworksChatClient({
    apiKey: "test-key",
    model: "accounts/fireworks/models/test-model",
    fetcher: async (input, init) => {
      request = new Request(input, init);
      return Response.json({
        id: "response-3",
        model: "accounts/fireworks/models/test-model",
        choices: [{ finish_reason: "stop", message: { role: "assistant", content: "Title" } }]
      });
    }
  });

  await client.complete({
    messages: [{ role: "user", content: "Draft a strawberry mead" }],
    maxOutputTokens: 32,
    reasoningEffort: "none",
    responseFormat: {
      type: "json_schema",
      json_schema: {
        name: "chat_title",
        schema: { type: "object" }
      }
    },
    toolChoice: "none",
    userId: 42
  });

  const body = await request?.json();
  assert.equal(body?.reasoning_effort, "none");
  assert.deepEqual(body?.response_format, {
    type: "json_schema",
    json_schema: {
      name: "chat_title",
      schema: { type: "object" }
    }
  });
});

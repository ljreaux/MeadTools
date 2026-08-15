import assert from "node:assert/strict";
import test from "node:test";
import { OpenAIChatClient } from "./openai";

test("OpenAI client sends a server-side chat completion without storing content", async () => {
  let request: Request | undefined;
  const client = new OpenAIChatClient({
    apiKey: "test-key",
    model: "gpt-5.4-mini-2026-03-17",
    fetcher: async (input, init) => {
      request = new Request(input, init);
      return Response.json({
        id: "chatcmpl_test",
        model: "gpt-5.4-mini-2026-03-17",
        choices: [{ finish_reason: "stop", message: { role: "assistant", content: "Hello" } }],
        usage: {
          prompt_tokens: 100,
          completion_tokens: 25,
          total_tokens: 125,
          prompt_tokens_details: { cached_tokens: 80 }
        }
      });
    }
  });

  const completion = await client.complete({
    userId: 2,
    maxOutputTokens: 400,
    reasoningEffort: "none",
    messages: [{ role: "user", content: "Hello" }]
  });

  assert.equal(client.provider, "openai");
  assert.equal(request?.url, "https://api.openai.com/v1/chat/completions");
  assert.equal(request?.headers.get("authorization"), "Bearer test-key");
  assert.deepEqual(await request?.json(), {
    model: "gpt-5.4-mini-2026-03-17",
    messages: [{ role: "user", content: "Hello" }],
    reasoning_effort: "none",
    max_completion_tokens: 400,
    store: false
  });
  assert.equal(completion.usage.cachedInputTokens, 80);
});

test("OpenAI client omits tool choice for a deliberately tool-free request", async () => {
  let body: Record<string, unknown> | undefined;
  const client = new OpenAIChatClient({
    apiKey: "test-key",
    model: "gpt-5.4-mini-2026-03-17",
    fetcher: async (_input, init) => {
      body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return Response.json({
        id: "chatcmpl_test",
        model: "gpt-5.4-mini-2026-03-17",
        choices: [{ finish_reason: "stop", message: { role: "assistant", content: "Title" } }]
      });
    }
  });

  await client.complete({
    userId: 2,
    maxOutputTokens: 64,
    toolChoice: "none",
    messages: [{ role: "user", content: "Title this chat" }]
  });

  assert.equal(body?.tools, undefined);
  assert.equal(body?.tool_choice, undefined);
  assert.equal(body?.parallel_tool_calls, undefined);
});

test("OpenAI client constrains parallel calls when function tools are present", async () => {
  let body: Record<string, unknown> | undefined;
  const client = new OpenAIChatClient({
    apiKey: "test-key",
    model: "gpt-5.4-mini-2026-03-17",
    fetcher: async (_input, init) => {
      body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return Response.json({
        id: "chatcmpl_test",
        model: "gpt-5.4-mini-2026-03-17",
        choices: [{ finish_reason: "tool_calls", message: { role: "assistant", content: null } }]
      });
    }
  });

  await client.complete({
    userId: 2,
    maxOutputTokens: 64,
    tools: [{
      type: "function",
      function: { name: "lookup", description: "Lookup", parameters: { type: "object" } }
    }],
    toolChoice: "auto",
    messages: [{ role: "user", content: "Lookup this" }]
  });

  assert.equal(body?.tool_choice, "auto");
  assert.equal(body?.parallel_tool_calls, false);
});

test("OpenAI client maps maximum reasoning to the highest supported effort", async () => {
  let body: Record<string, unknown> | undefined;
  const client = new OpenAIChatClient({
    apiKey: "test-key",
    model: "gpt-5.4-mini-2026-03-17",
    fetcher: async (_input, init) => {
      body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return Response.json({
        id: "chatcmpl_test",
        model: "gpt-5.4-mini-2026-03-17",
        choices: [{ finish_reason: "stop", message: { role: "assistant", content: "Hello" } }]
      });
    }
  });

  await client.complete({
    userId: 2,
    maxOutputTokens: 400,
    reasoningEffort: "max",
    messages: [{ role: "user", content: "Hello" }]
  });

  assert.equal(body?.reasoning_effort, "high");
});

test("OpenAI client does not retry a failed completion", async () => {
  let calls = 0;
  const client = new OpenAIChatClient({
    apiKey: "test-key",
    model: "gpt-5.4-mini-2026-03-17",
    fetcher: async () => {
      calls += 1;
      return new Response("unavailable", { status: 503 });
    }
  });

  await assert.rejects(
    client.complete({
      userId: 2,
      maxOutputTokens: 400,
      messages: [{ role: "user", content: "Hello" }]
    }),
    /openai inference failed with HTTP 503\./
  );
  assert.equal(calls, 1);
});

test("OpenAI client retains structured provider error metadata without secrets", async () => {
  const client = new OpenAIChatClient({
    apiKey: "test-key",
    model: "gpt-5.4-mini-2026-03-17",
    fetcher: async () => Response.json({
      error: {
        message: "Unsupported parameter: response_format. Bearer sk-not-a-real-key",
        type: "invalid_request_error",
        param: "response_format",
        code: "unsupported_parameter"
      }
    }, { status: 400 })
  });

  await assert.rejects(
    client.complete({
      userId: 2,
      maxOutputTokens: 400,
      messages: [{ role: "user", content: "Hello" }]
    }),
    (error: unknown) => {
      assert.match(error instanceof Error ? error.message : "", /Unsupported parameter/);
      assert.doesNotMatch(error instanceof Error ? error.message : "", /sk-not-a-real-key/);
      return true;
    }
  );
});

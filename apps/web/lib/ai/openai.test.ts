import assert from "node:assert/strict";
import test from "node:test";
import { OpenAIChatClient } from "./openai";

test("OpenAI client uses Responses with manual state and does not store content", async () => {
  let request: Request | undefined;
  const client = new OpenAIChatClient({
    apiKey: "test-key",
    model: "gpt-5.4-mini-2026-03-17",
    fetcher: async (input, init) => {
      request = new Request(input, init);
      return Response.json({
        id: "resp_test",
        model: "gpt-5.4-mini-2026-03-17",
        status: "completed",
        output: [
          {
            type: "message",
            role: "assistant",
            content: [{ type: "output_text", text: "Hello" }],
          },
        ],
        usage: {
          input_tokens: 100,
          output_tokens: 25,
          total_tokens: 125,
          input_tokens_details: { cached_tokens: 80 },
        },
      });
    },
  });

  const completion = await client.complete({
    userId: 2,
    maxOutputTokens: 400,
    reasoningEffort: "none",
    messages: [{ role: "user", content: "Hello" }],
  });

  assert.equal(client.provider, "openai");
  assert.equal(request?.url, "https://api.openai.com/v1/responses");
  assert.equal(request?.headers.get("authorization"), "Bearer test-key");
  assert.deepEqual(await request?.json(), {
    model: "gpt-5.4-mini-2026-03-17",
    input: [{ role: "user", content: "Hello" }],
    reasoning: { effort: "none" },
    max_output_tokens: 400,
    store: false,
  });
  assert.equal(completion.message.content, "Hello");
  assert.equal(completion.usage.cachedInputTokens, 80);
});

test("OpenAI client omits tool controls for a deliberately tool-free title request", async () => {
  let body: Record<string, unknown> | undefined;
  const client = new OpenAIChatClient({
    apiKey: "test-key",
    model: "gpt-5.4-mini-2026-03-17",
    fetcher: async (_input, init) => {
      body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return Response.json(completedTextResponse("Title"));
    },
  });

  await client.complete({
    userId: 2,
    maxOutputTokens: 64,
    toolChoice: "none",
    responseFormat: titleFormat,
    messages: [{ role: "user", content: "Title this chat" }],
  });

  assert.equal(body?.tools, undefined);
  assert.equal(body?.tool_choice, undefined);
  assert.equal(body?.parallel_tool_calls, undefined);
  assert.deepEqual(body?.text, {
    format: {
      type: "json_schema",
      name: "title",
      schema: { type: "object" },
      strict: true,
    },
  });
});

test("OpenAI client maps forced function calls and subsequent tool output to Responses items", async () => {
  let body: Record<string, unknown> | undefined;
  const client = new OpenAIChatClient({
    apiKey: "test-key",
    model: "gpt-5.4-mini-2026-03-17",
    fetcher: async (_input, init) => {
      body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return Response.json({
        id: "resp_tool",
        model: "gpt-5.4-mini-2026-03-17",
        status: "completed",
        // The live Responses API includes this nullable field for a normal,
        // completed function-call response.
        incomplete_details: null,
        output: [
          {
            type: "function_call",
            call_id: "call_lookup",
            name: "lookup",
            arguments: '{"query":"honey"}',
          },
        ],
        usage: { input_tokens: 10, output_tokens: 3, total_tokens: 13 },
      });
    },
  });

  const completion = await client.complete({
    userId: 2,
    maxOutputTokens: 64,
    tools: [lookupTool],
    toolChoice: { type: "function", function: { name: "lookup" } },
    messages: [
      { role: "system", content: "Use the lookup." },
      {
        role: "assistant",
        content: null,
        tool_calls: [
          {
            id: "prior_call",
            type: "function",
            function: { name: "lookup", arguments: '{"query":"fruit"}' },
          },
        ],
      },
      { role: "tool", tool_call_id: "prior_call", content: '{"name":"Berry"}' },
      { role: "user", content: "Continue" },
    ],
  });

  assert.deepEqual(body?.tools, [
    {
      type: "function",
      name: "lookup",
      description: "Lookup",
      parameters: { type: "object" },
    },
  ]);
  assert.deepEqual(body?.tool_choice, { type: "function", name: "lookup" });
  assert.equal(body?.parallel_tool_calls, false);
  assert.deepEqual(body?.input, [
    { role: "system", content: "Use the lookup." },
    {
      type: "function_call",
      call_id: "prior_call",
      name: "lookup",
      arguments: '{"query":"fruit"}',
    },
    {
      type: "function_call_output",
      call_id: "prior_call",
      output: '{"name":"Berry"}',
    },
    { role: "user", content: "Continue" },
  ]);
  assert.deepEqual(completion.message.tool_calls, [
    {
      id: "call_lookup",
      type: "function",
      function: { name: "lookup", arguments: '{"query":"honey"}' },
    },
  ]);
});

test("OpenAI client maps maximum reasoning to the highest Responses effort", async () => {
  let body: Record<string, unknown> | undefined;
  const client = new OpenAIChatClient({
    apiKey: "test-key",
    model: "gpt-5.4-mini-2026-03-17",
    fetcher: async (_input, init) => {
      body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return Response.json(completedTextResponse("Hello"));
    },
  });

  await client.complete({
    userId: 2,
    maxOutputTokens: 400,
    reasoningEffort: "max",
    messages: [{ role: "user", content: "Hello" }],
  });

  assert.deepEqual(body?.reasoning, { effort: "high" });
});

test("OpenAI client maps Responses token-limit completion to the shared length signal", async () => {
  const client = new OpenAIChatClient({
    apiKey: "test-key",
    model: "gpt-5.4-mini-2026-03-17",
    fetcher: async () =>
      Response.json({
        ...completedTextResponse("Partial"),
        status: "incomplete",
        incomplete_details: { reason: "max_output_tokens" },
      }),
  });

  const completion = await client.complete({
    userId: 2,
    maxOutputTokens: 64,
    messages: [{ role: "user", content: "Hello" }],
  });

  assert.equal(completion.finishReason, "length");
});

test("OpenAI client does not retry a failed Responses request", async () => {
  let calls = 0;
  const client = new OpenAIChatClient({
    apiKey: "test-key",
    model: "gpt-5.4-mini-2026-03-17",
    fetcher: async () => {
      calls += 1;
      return new Response("unavailable", { status: 503 });
    },
  });

  await assert.rejects(
    client.complete({
      userId: 2,
      maxOutputTokens: 400,
      messages: [{ role: "user", content: "Hello" }],
    }),
    /openai inference failed with HTTP 503\./,
  );
  assert.equal(calls, 1);
});

test("OpenAI client retains structured provider error metadata without secrets", async () => {
  const client = new OpenAIChatClient({
    apiKey: "test-key",
    model: "gpt-5.4-mini-2026-03-17",
    fetcher: async () =>
      Response.json(
        {
          error: {
            message:
              "Unsupported parameter: text.format. Bearer sk-not-a-real-key",
            type: "invalid_request_error",
            param: "text.format",
            code: "unsupported_parameter",
          },
        },
        { status: 400 },
      ),
  });

  await assert.rejects(
    client.complete({
      userId: 2,
      maxOutputTokens: 400,
      messages: [{ role: "user", content: "Hello" }],
    }),
    (error: unknown) => {
      assert.match(
        error instanceof Error ? error.message : "",
        /Unsupported parameter/,
      );
      assert.doesNotMatch(
        error instanceof Error ? error.message : "",
        /sk-not-a-real-key/,
      );
      return true;
    },
  );
});

const lookupTool = {
  type: "function" as const,
  function: {
    name: "lookup",
    description: "Lookup",
    parameters: { type: "object" },
  },
};

const titleFormat = {
  type: "json_schema" as const,
  json_schema: {
    name: "title",
    schema: { type: "object" },
    strict: true,
  },
};

function completedTextResponse(text: string) {
  return {
    id: "resp_test",
    model: "gpt-5.4-mini-2026-03-17",
    status: "completed",
    output: [
      {
        type: "message",
        role: "assistant",
        content: [{ type: "output_text", text }],
      },
    ],
  };
}

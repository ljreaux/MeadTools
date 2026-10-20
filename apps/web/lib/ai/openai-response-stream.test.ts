import assert from "node:assert/strict";
import test from "node:test";
import { readOpenAIResponseStream } from "./openai-response-stream";
import { OpenAIChatClient } from "./openai";
const encode = new TextEncoder();
const event = (value: unknown) => `data: ${JSON.stringify(value)}\r\n\r\n`;
const completed = { id: "resp_stream", model: "offline", status: "completed", output: [{ type: "message", role: "assistant", content: [{ type: "output_text", text: "Honey mead" }] }], usage: { input_tokens: 30, output_tokens: 2, total_tokens: 32, input_tokens_details: { cached_tokens: 20 } } };

test("public text arrives before completion; fragmented SSE retains final usage", async () => {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const response = new Response(new ReadableStream<Uint8Array>({ start(c) { controller = c; } }));
  let seen!: () => void;
  const first = new Promise<void>(resolve => { seen = resolve; });
  const deltas: string[] = [];
  const promise = readOpenAIResponseStream(response, delta => { deltas.push(delta); seen(); });
  const wire = event({ type: "response.output_text.delta", delta: "Honey " });
  controller.enqueue(encode.encode(wire.slice(0, 8)));
  controller.enqueue(encode.encode(wire.slice(8)));
  await first;
  assert.deepEqual(deltas, ["Honey "]);
  controller.enqueue(encode.encode(event({ type: "response.reasoning_text.delta", delta: "PRIVATE" }) + event({ type: "response.function_call_arguments.delta", delta: "PRIVATE" }) + event({ type: "response.completed", response: completed })));
  controller.close();
  assert.deepEqual(await promise, completed);
  assert.deepEqual(deltas, ["Honey "]);
});

test("tool-bearing responses discard any answer preview and never stream arguments", async () => {
  const deltas: string[] = []; let resets = 0;
  const wire = event({ type: "response.output_item.added", item: { type: "function_call" } }) + event({ type: "response.output_text.delta", delta: "Not final" }) + event({ type: "response.completed", response: completed });
  await readOpenAIResponseStream(new Response(wire), d => deltas.push(d), () => resets++);
  assert.deepEqual(deltas, []); assert.equal(resets, 1);
});

for (const wire of [event({ type: "response.output_text.delta", delta: "Partial" }), event({ type: "error", message: "secret provider detail" }), 'data: invalid\n\n']) {
  test("a broken stream cannot become a completed answer", async () => {
    await assert.rejects(readOpenAIResponseStream(new Response(wire), () => {}));
  });
}

test("OpenAI streaming normalizes final tool calls and token accounting without retry", async () => {
  let attempts = 0;
  const final = { ...completed, output: [{ type: "function_call", call_id: "call-1", name: "get_recipe", arguments: '{"id":6}' }] };
  const client = new OpenAIChatClient({ apiKey: "test-only", model: "offline", fetcher: async (_url, init) => {
    attempts++; assert.equal(JSON.parse(String(init?.body)).stream, true);
    return new Response(event({ type: "response.completed", response: final }));
  } });
  const result = await client.complete({ messages: [{ role: "user", content: "Read my recipe" }], userId: 1, maxOutputTokens: 100, onTextDelta: () => {} });
  assert.equal(attempts, 1); assert.equal(result.usage.totalTokens, 32);
  assert.equal(result.message.tool_calls?.[0].function.arguments, '{"id":6}');
});

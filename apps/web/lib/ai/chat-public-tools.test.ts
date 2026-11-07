import assert from "node:assert/strict";
import test from "node:test";
import {
  executeMcpAgentTool,
  publicReadToolNames,
  type PublicReadAdapter,
} from "@meadtools/recipe-agent";
import { runChatTurn } from "./chat-service";
import type { ChatModelClient, ChatCompletionRequest } from "./chat-model";

test("hosted chat shares all public tools without account consent, and public reads are fresh", async () => {
  const requests: ChatCompletionRequest[] = [];
  let reads = 0,
    step = 0;
  const adapter: PublicReadAdapter = {
    origin: "https://meadtools.com",
    candidates: async () => {
      reads++;
      return [];
    },
    get: async () => null,
  };
  const client: ChatModelClient = {
    async complete(request) {
      requests.push(request);
      step++;
      return {
        id: `mock-${step}`,
        model: "mock",
        usage: {
          inputTokens: 10,
          cachedInputTokens: 0,
          outputTokens: 10,
          totalTokens: 20,
        },
        message:
          step <= 2
            ? {
                role: "assistant",
                content: null,
                tool_calls: [
                  {
                    id: `call-${step}`,
                    type: "function",
                    function: {
                      name: "summarize_public_brews",
                      arguments: "{}",
                    },
                  },
                ],
              }
            : { role: "assistant", content: "No public mead brews matched." },
      };
    },
  };
  const result = await runChatTurn({
    client,
    userId: 42,
    maxToolCalls: 4,
    maxOutputTokens: 500,
    publicReadAdapter: adapter,
    request: {
      messages: [
        {
          role: "user",
          content: "Compare recorded results across public mead brews.",
        },
      ],
    },
  });
  assert.equal(
    reads,
    2,
    "Public results cannot be reused after a visibility change",
  );
  for (const name of publicReadToolNames)
    assert.ok(requests[0].tools?.some((t) => t.function.name === name));
  assert.equal(
    requests[0].tools?.some((t) => t.function.name === "get_brew"),
    false,
  );
  assert.equal(result.toolResults.length, 2);
  assert.deepEqual(
    result.toolResults[0].result,
    await executeMcpAgentTool(
      "summarize_public_brews",
      {},
      { publicReadAdapter: adapter },
    ),
  );
});

import assert from "node:assert/strict";
import test from "node:test";
import { formatChatSessionMarkdown } from "./chat-export";

test("exports the in-memory conversation with assistant tool and usage context", () => {
  const exportText = formatChatSessionMarkdown({
    exportedAt: new Date("2026-07-22T15:30:00.000Z"),
    model: "accounts/fireworks/models/deepseek-v4-flash",
    messages: [
      { role: "user", content: "Create a traditional mead." },
      {
        role: "assistant",
        content: "Which batch volume would you like?",
        tools: ["build_recipe_draft"],
        usage: {
          model: "accounts/fireworks/models/deepseek-v4-flash",
          inputTokens: 120,
          outputTokens: 40,
          totalTokens: 160,
          cachedInputTokens: 10,
          toolCalls: 1,
          latencyMs: 850
        }
      }
    ]
  });

  assert.match(exportText, /Exported: 2026-07-22T15:30:00.000Z/);
  assert.match(exportText, /## You/);
  assert.match(exportText, /## MeadTools chatbot/);
  assert.match(exportText, /### Tools used/);
  assert.match(exportText, /build_recipe_draft/);
  assert.match(exportText, /Tokens: 160 total/);
  assert.match(exportText, /Storage: Browser session only/);
});

export type ChatSessionMessage = {
  role: "user" | "assistant";
  content: string;
  tools?: string[];
  usage?: {
    model: string;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    cachedInputTokens: number;
    toolCalls: number;
    latencyMs: number;
  };
};

export function formatChatSessionMarkdown(options: {
  messages: ChatSessionMessage[];
  exportedAt: Date;
  model?: string;
}): string {
  const { messages, exportedAt, model } = options;
  const header = [
    "# MeadTools assistant session",
    "",
    `- Exported: ${exportedAt.toISOString()}`,
    `- Model: ${model ?? "Not reported"}`,
    "- Storage: Browser session only; this export does not create a saved chat.",
    ""
  ];

  const transcript = messages.flatMap((message) => [
    "---",
    "",
    `## ${message.role === "user" ? "You" : "MeadTools chatbot"}`,
    "",
    message.content.trim(),
    ...(message.tools && message.tools.length > 0
      ? ["", "### Tools used", "", ...message.tools.map((tool) => `- ${tool}`)]
      : []),
    ...(message.usage
      ? [
          "",
          "### Metering",
          "",
          `- Model: ${message.usage.model}`,
          `- Tokens: ${message.usage.totalTokens} total (${message.usage.inputTokens} input, ${message.usage.outputTokens} output, ${message.usage.cachedInputTokens} cached input)`,
          `- Tool calls: ${message.usage.toolCalls}`,
          `- Latency: ${message.usage.latencyMs} ms`
        ]
      : []),
    ""
  ]);

  return [...header, ...transcript].join("\n");
}

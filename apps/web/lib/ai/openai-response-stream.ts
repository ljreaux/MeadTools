/** Read public text and the authoritative terminal response; never forward
 * reasoning, function arguments, or partial tool output to the browser. */
export async function readOpenAIResponseStream(
  response: Response,
  onTextDelta: (delta: string) => void,
  onTextReset?: () => void,
): Promise<unknown> {
  if (!response.body) throw new Error("OpenAI returned an empty response stream.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let data: string[] = [];
  let terminal: unknown;
  let hasToolCall = false;
  const dispatch = () => {
    if (!data.length) return;
    const text = data.join("\n");
    data = [];
    if (text === "[DONE]") return;
    const event = JSON.parse(text) as Record<string, unknown>;
    if (event.type === "error" || event.type === "response.failed") {
      throw new Error("OpenAI response stream failed.");
    }
    if (event.type === "response.output_item.added" &&
        typeof event.item === "object" && event.item !== null &&
        "type" in event.item && event.item.type === "function_call") {
      hasToolCall = true;
      onTextReset?.();
    }
    if (event.type === "response.output_text.delta" && typeof event.delta === "string" && !hasToolCall) {
      onTextDelta(event.delta);
    }
    if (event.type === "response.completed" || event.type === "response.incomplete") terminal = event.response;
  };
  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      if (buffer.length > 2_000_000) throw new Error("OpenAI response stream exceeded the event limit.");
      let newline: number;
      while ((newline = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, newline).replace(/\r$/, "");
        buffer = buffer.slice(newline + 1);
        if (!line) dispatch();
        else if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
      }
      if (done) break;
    }
    if (buffer.startsWith("data:")) data.push(buffer.slice(5).trimStart());
    dispatch();
    if (!terminal) throw new Error("OpenAI response stream ended before completion.");
    return terminal;
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

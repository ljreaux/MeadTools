import type { StreamChunk } from "@tanstack/ai";
import { EventType } from "@tanstack/ai/client";
import type { ChatTurnEvent, ChatTurnResult } from "./chat-service";

const DISPLAY_CHUNK_SIZE = 48;

export function streamRecipeChatTurn(options: {
  model: string;
  runId: string;
  threadId: string;
  run: (onEvent: (event: ChatTurnEvent) => void) => Promise<ChatTurnResult>;
}): AsyncIterable<StreamChunk> {
  return createStream(options);
}

async function* createStream(options: {
  model: string;
  runId: string;
  threadId: string;
  run: (onEvent: (event: ChatTurnEvent) => void) => Promise<ChatTurnResult>;
}): AsyncGenerator<StreamChunk> {
  const toolEvents = new AsyncQueue<ChatTurnEvent>();
  const resultPromise = options.run((event) => toolEvents.push(event));
  const timestamp = Date.now();

  yield {
    type: EventType.RUN_STARTED,
    runId: options.runId,
    threadId: options.threadId,
    model: options.model,
    timestamp
  };

  resultPromise.finally(() => toolEvents.close()).catch(() => undefined);

  try {
    for await (const event of toolEvents) {
      yield {
        type: EventType.CUSTOM,
        name: "recipe.tool",
        value: event,
        model: options.model,
        timestamp: Date.now()
      };
    }

    const result = await resultPromise;
    const messageId = crypto.randomUUID();
    yield {
      type: EventType.CUSTOM,
      name: "recipe.turn",
      value: { messageId, result },
      model: options.model,
      timestamp: Date.now()
    };
    yield {
      type: EventType.TEXT_MESSAGE_START,
      messageId,
      role: "assistant",
      model: options.model,
      timestamp: Date.now()
    };

    for (const delta of splitForDisplay(result.answer)) {
      yield {
        type: EventType.TEXT_MESSAGE_CONTENT,
        messageId,
        delta,
        model: options.model,
        timestamp: Date.now()
      };
      await new Promise((resolve) => setTimeout(resolve, 12));
    }

    yield {
      type: EventType.TEXT_MESSAGE_END,
      messageId,
      model: options.model,
      timestamp: Date.now()
    };
    yield {
      type: EventType.RUN_FINISHED,
      runId: options.runId,
      threadId: options.threadId,
      model: options.model,
      timestamp: Date.now(),
      finishReason: "stop"
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Chatbot request failed.";
    yield {
      type: EventType.RUN_ERROR,
      runId: options.runId,
      threadId: options.threadId,
      model: options.model,
      timestamp: Date.now(),
      message,
      error: { message }
    };
  }
}

function splitForDisplay(answer: string): string[] {
  const chunks: string[] = [];
  for (let index = 0; index < answer.length; index += DISPLAY_CHUNK_SIZE) {
    chunks.push(answer.slice(index, index + DISPLAY_CHUNK_SIZE));
  }
  return chunks.length > 0 ? chunks : [" "];
}

class AsyncQueue<T> {
  private readonly values: T[] = [];
  private resolveNext: ((result: IteratorResult<T>) => void) | undefined;
  private closed = false;

  push(value: T) {
    if (this.closed) return;
    const resolve = this.resolveNext;
    if (resolve) {
      this.resolveNext = undefined;
      resolve({ value, done: false });
      return;
    }
    this.values.push(value);
  }

  close() {
    this.closed = true;
    const resolve = this.resolveNext;
    if (resolve) {
      this.resolveNext = undefined;
      resolve({ value: undefined as never, done: true });
    }
  }

  async *[Symbol.asyncIterator](): AsyncGenerator<T> {
    while (true) {
      const next = this.values.shift();
      if (next !== undefined) {
        yield next;
        continue;
      }
      if (this.closed) return;
      const result = await new Promise<IteratorResult<T>>((resolve) => {
        this.resolveNext = resolve;
      });
      if (result.done) return;
      yield result.value;
    }
  }
}

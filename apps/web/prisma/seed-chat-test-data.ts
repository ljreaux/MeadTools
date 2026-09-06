import { config } from "dotenv";
import {
  chat_conversation_state,
  chat_message_role,
  chat_message_status,
} from "@prisma/client";

config({ path: "../../.env.local" });
config({ path: "../../.env" });

const { default: prisma } = await import("../lib/prisma");

const TEST_TITLE_PREFIX = "Chat persistence demo —";
const RETENTION_DAYS = 90;

function assertSafeLocalDatabase() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Chat test data cannot be seeded in production.");
  }
  if (process.env.ALLOW_CHAT_TEST_DATA !== "true") {
    throw new Error(
      'Refusing to run: set ALLOW_CHAT_TEST_DATA="true" to seed local chat test data.',
    );
  }

  const value = process.env.DATABASE_URL;
  if (!value) throw new Error("DATABASE_URL is not set.");
  const database = new URL(value).pathname.replace("/", "");
  if (!new Set(["meadtools_dev", "meadtools_test"]).has(database)) {
    throw new Error(
      "Chat test data can only be seeded into an approved local database.",
    );
  }
}

function expiresAt(activityAt: Date) {
  const expires = new Date(activityAt);
  expires.setUTCDate(expires.getUTCDate() + RETENTION_DAYS);
  return expires;
}

function textBytes(values: string[]) {
  return new TextEncoder().encode(values.join("")).byteLength;
}

async function createDemoConversation(options: {
  userId: number;
  title: string;
  activityAt: Date;
  state?: chat_conversation_state;
  messages: Array<{ role: chat_message_role; content: string }>;
}) {
  const messages = options.messages.map((message, index) => ({
    sequence: index + 1,
    role: message.role,
    status: chat_message_status.complete,
    content: message.content,
    completed_at: options.activityAt,
  }));
  await prisma.chat_conversations.create({
    data: {
      user_id: options.userId,
      title: options.title,
      state: options.state ?? chat_conversation_state.active,
      next_sequence: messages.length + 1,
      message_count: messages.length,
      content_bytes: textBytes(messages.map((message) => message.content)),
      last_activity_at: options.activityAt,
      expires_at: expiresAt(options.activityAt),
      messages: { create: messages },
    },
  });
}

async function main() {
  assertSafeLocalDatabase();
  const users = await prisma.users.findMany({
    where: { role: { in: ["admin", "user"] } },
    orderBy: { id: "asc" },
    select: { id: true },
  });
  if (users.length === 0) {
    throw new Error("No local admin or user is available for chat test data.");
  }

  await prisma.chat_conversations.deleteMany({
    where: {
      user_id: { in: users.map((user) => user.id) },
      title: { startsWith: TEST_TITLE_PREFIX },
    },
  });

  const now = new Date();
  const topics = [
    "Blackberry Bochet Planning",
    "Spring Wildflower Traditional",
    "Cyser Fermentation Check",
    "Blueberry Vanilla Mead",
    "Carbonation Troubleshooting",
    "Orange Blossom Show Mead",
    "Raspberry Acerglyn Draft",
    "Stabilization Before Backsweetening",
    "Cherry Pyment Notes",
    "Nutrient Schedule Review",
    "Peach Melomel Design",
    "Hydrometer Reading Questions",
    "Spiced Bochet Experiment",
    "Apple Cider Blend",
    "Strawberry Shortcake Mead",
    "Mead Clarification Process",
    "Black Currant Recipe",
    "Oak Addition Timing",
    "Lavender Traditional Draft",
    "Carbonated Session Mead",
    "Vanilla Bean Addition",
    "Blueberry Bochet Revision",
    "Cyser Backsweetening",
    "Acid Blend Bench Trial",
  ];

  for (const user of users) {
    for (const [index, topic] of topics.entries()) {
      const activityAt = new Date(now);
      activityAt.setUTCDate(activityAt.getUTCDate() - index - 1);
      await createDemoConversation({
        userId: user.id,
        title: `${TEST_TITLE_PREFIX}${topic}`,
        activityAt,
        state: index >= 22 ? chat_conversation_state.archived : undefined,
        messages: [
          {
            role: chat_message_role.user,
            content: `Help me with ${topic.toLowerCase()}.`,
          },
          {
            role: chat_message_role.assistant,
            content:
              "This is local persistence test data. No provider call was made.",
          },
        ],
      });
    }

    const longTranscriptActivity = new Date(now);
    longTranscriptActivity.setUTCDate(longTranscriptActivity.getUTCDate() - 30);
    await createDemoConversation({
      userId: user.id,
      title: `${TEST_TITLE_PREFIX}Long Transcript Pagination`,
      activityAt: longTranscriptActivity,
      messages: Array.from({ length: 60 }, (_, index) => ({
        role:
          index % 2 === 0
            ? chat_message_role.user
            : chat_message_role.assistant,
        content: `Local transcript message ${index + 1} for pagination testing.`,
      })),
    });

    const capacityActivity = new Date(now);
    capacityActivity.setUTCDate(capacityActivity.getUTCDate() - 31);
    await prisma.chat_conversations.create({
      data: {
        user_id: user.id,
        title: `${TEST_TITLE_PREFIX}Capacity Recovery`,
        next_sequence: 501,
        message_count: 500,
        content_bytes: 0,
        last_activity_at: capacityActivity,
        expires_at: expiresAt(capacityActivity),
      },
    });
  }

  console.log(
    `Seeded ${users.length * 26} local chat threads, including transcript pagination and capacity-recovery cases.`,
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

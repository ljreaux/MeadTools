import prisma from "../prisma";

type ChatAdditiveCatalogEntry = {
  id: string;
  name: string;
  dosage: number;
  unit: string;
};

let chatAdditiveCatalog: Promise<ChatAdditiveCatalogEntry[]> | undefined;

/**
 * The additive catalog is small and changes rarely. Keep one warm-instance
 * copy for chatbot lookup; admin mutations clear it immediately.
 */
export async function getAdditiveCatalogForChat() {
  try {
    chatAdditiveCatalog ??= prisma.additives.findMany({
      select: { id: true, name: true, dosage: true, unit: true },
      orderBy: { name: "asc" },
    });
    return await chatAdditiveCatalog;
  } catch (error) {
    chatAdditiveCatalog = undefined;
    console.error("Error loading additives for chat:", error);
    throw new Error("Could not load additives");
  }
}

export function invalidateChatAdditiveCatalog() {
  chatAdditiveCatalog = undefined;
}

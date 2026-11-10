import { config } from "dotenv";
import { isLocalDevDatabase, saveLocalChatGptClient } from "../prisma/local-chatgpt-client";

config({ path: "../../.env.local", quiet: true });
config({ path: "../../.env", quiet: true });

if (!isLocalDevDatabase(process.env.DATABASE_URL)) {
  throw new Error("Run this against the local MeadTools Docker database.");
}
const clientId = process.argv[2];
if (!clientId || process.argv.length !== 3) {
  throw new Error("Pass the client ID of the ChatGPT registration to preserve.");
}

const { default: prisma } = await import("../lib/prisma");
try {
  const registration = await prisma.mcp_oauth_clients.findUnique({
    where: { client_id: clientId },
    select: { client_id: true, client_name: true, redirect_uris: true },
  });
  saveLocalChatGptClient(registration);
  console.log("Saved the local ChatGPT client registration for future resets.");
} finally {
  await prisma.$disconnect();
}

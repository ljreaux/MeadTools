import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { parseMcpClientRegistration } from "../lib/mcp/client-registration";

const snapshotPath = fileURLToPath(
  new URL("../../../.local-chatgpt-client.json", import.meta.url)
);

export function isLocalDevDatabase(databaseUrl: string | undefined) {
  const url = URL.parse(databaseUrl ?? "");
  return !!url &&
    ["postgresql:", "postgres:"].includes(url.protocol) &&
    ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) &&
    url.port === "54329" && url.pathname === "/meadtools_dev" &&
    !url.searchParams.has("host");
}

function parseChatGptClient(input: unknown) {
  const registration = parseMcpClientRegistration(input);
  const clientId = (input as { client_id?: unknown } | null)?.client_id;
  if (
    !registration ||
    typeof clientId !== "string" ||
    !/^mtmcp_client_[A-Za-z0-9_-]{43}$/.test(clientId) ||
    !registration.uris.every((uri) => new URL(uri).origin === "https://chatgpt.com")
  ) {
    throw new Error("Expected a registered ChatGPT OAuth client.");
  }
  return { client_id: clientId, client_name: registration.name, redirect_uris: registration.uris };
}

export function saveLocalChatGptClient(input: unknown) {
  const client = parseChatGptClient(input);
  const temporaryPath = snapshotPath + "." + randomUUID() + ".tmp";
  writeFileSync(temporaryPath, JSON.stringify(client) + "\n", { mode: 0o600, flag: "wx" });
  renameSync(temporaryPath, snapshotPath);
}

export function loadLocalChatGptClient(databaseUrl: string | undefined) {
  if (!isLocalDevDatabase(databaseUrl)) return null;
  try {
    return parseChatGptClient(JSON.parse(readFileSync(snapshotPath, "utf8")));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw new Error("The local ChatGPT registration snapshot is invalid.");
  }
}

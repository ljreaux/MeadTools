import { z } from "zod";
import { calculateRecipeDerivedApiResponse } from "@meadtools/core/derived";
import { recipeDerivedStateResponseBodySchema } from "@meadtools/api-contract/schemas";
import { recipeDataV2Schema } from "@meadtools/schemas";

// Fragments never enter HTTP requests or Referer headers. No server storage.
export const MAX_DRAFT_TOKEN_LENGTH = 24000;
export const draftHandoffSchema = z
  .object({
    version: z.literal(1),
    name: z.string().trim().min(1).max(160),
    recipeData: recipeDataV2Schema,
    warnings: z.array(z.string().max(2000)).max(30),
    assumptions: z.array(z.string().max(2000)).max(30)
  })
  .strict();
export type DraftHandoff = z.infer<typeof draftHandoffSchema>;

export function encodeDraftHandoff(input: DraftHandoff): string {
  const json = JSON.stringify(draftHandoffSchema.parse(input));
  const bytes = new TextEncoder().encode(json);
  if (bytes.length > MAX_DRAFT_TOKEN_LENGTH * 0.75)
    throw new Error("Draft is too large to open by link.");
  const token = btoa(
    Array.from(bytes, (byte) => String.fromCharCode(byte)).join("")
  )
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  if (token.length > MAX_DRAFT_TOKEN_LENGTH)
    throw new Error("Draft is too large to open by link.");
  return token;
}

export function decodeDraftHandoff(token: string): DraftHandoff {
  if (
    !token ||
    token.length > MAX_DRAFT_TOKEN_LENGTH ||
    !/^[A-Za-z0-9_-]+$/.test(token)
  ) {
    throw new Error("Invalid draft link.");
  }
  const binary = atob(token.replace(/-/g, "+").replace(/_/g, "/"));
  const json = new TextDecoder("utf-8", { fatal: true }).decode(
    Uint8Array.from(binary, (char) => char.charCodeAt(0))
  );
  const raw: unknown = JSON.parse(json);
  const parsed = draftHandoffSchema.parse(raw);
  rejectUnknownFields(raw, parsed);
  recipeDerivedStateResponseBodySchema.parse(
    calculateRecipeDerivedApiResponse(parsed.recipeData)
  );
  return parsed;
}

// Refuse future fields rather than silently stripping recipe settings.
function rejectUnknownFields(raw: unknown, parsed: unknown): void {
  if (!raw || typeof raw !== "object") return;
  if (!parsed || typeof parsed !== "object")
    throw new Error("Unsupported draft field.");
  for (const key of Object.keys(raw)) {
    if (!(key in parsed)) throw new Error("Unsupported draft field.");
    rejectUnknownFields(
      (raw as Record<string, unknown>)[key],
      (parsed as Record<string, unknown>)[key]
    );
  }
}

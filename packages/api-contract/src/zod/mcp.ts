import { z } from "zod";

export const mcpTokenSchema = z.object({
  id: z.string().uuid(),
  label: z.string(),
  accountRead: z.boolean().default(false),
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  lastUsedAt: z.string().datetime().nullable(),
});

export const mcpTokenListResponseSchema = z.object({
  endpoint: z.string().url(),
  tokens: z.array(mcpTokenSchema),
});

export const mcpTokenCreateBodySchema = z.object({
  label: z.string().trim().min(1).max(80),
  accountRead: z.boolean().optional(),
}).strict();

export const mcpTokenCreateResponseSchema = z.object({
  id: z.string().uuid(),
  label: z.string(),
  accountRead: z.boolean().default(false),
  token: z.string(),
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
});

export const mcpTokenRevokeResponseSchema = z.object({ revoked: z.literal(true) });
export const mcpErrorResponseSchema = z.object({ error: z.string() });

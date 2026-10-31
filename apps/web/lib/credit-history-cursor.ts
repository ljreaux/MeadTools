import { creditActivityResponseSchema } from "@meadtools/api-contract/credits";

export class InvalidCreditActivityCursorError extends Error {
  constructor() {
    super("The credit history cursor is invalid.");
    this.name = "InvalidCreditActivityCursorError";
  }
}

export function encodeCreditActivityCursor(cursor: {
  occurredAt: Date;
  operationId: string;
}): string {
  return Buffer.from(
    JSON.stringify({
      occurredAt: cursor.occurredAt.toISOString(),
      operationId: cursor.operationId,
    }),
  ).toString("base64url");
}

export function decodeCreditActivityCursor(value: string): {
  occurredAt: Date;
  operationId: string;
} {
  try {
    const parsed: unknown = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8"),
    );
    if (!isCreditActivityCursor(parsed))
      throw new InvalidCreditActivityCursorError();
    const occurredAt = new Date(parsed.occurredAt);
    if (Number.isNaN(occurredAt.getTime()))
      throw new InvalidCreditActivityCursorError();
    return { occurredAt, operationId: parsed.operationId };
  } catch (error) {
    if (error instanceof InvalidCreditActivityCursorError) throw error;
    throw new InvalidCreditActivityCursorError();
  }
}

function isCreditActivityCursor(
  value: unknown,
): value is { occurredAt: string; operationId: string } {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.occurredAt === "string" &&
    creditActivityResponseSchema.shape.activities.element.shape.operationId.safeParse(
      candidate.operationId,
    ).success
  );
}

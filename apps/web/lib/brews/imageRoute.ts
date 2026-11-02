import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { BrewImageError } from "@meadtools/brew-domain/images";
import { verifyUser } from "@/lib/userAccessFunctions";
import { brewImageCacheHeaders } from "@/lib/db/brew-images";

export async function imageViewer(req: NextRequest) {
  return req.nextUrl.searchParams.get("public") === "true"
    ? undefined
    : verifyUser(req);
}
export function imageRouteError(error: unknown) {
  const code =
    error instanceof BrewImageError
      ? error.code
      : error instanceof ZodError
        ? "INVALID_IMAGE"
        : "UPLOAD_FAILED";
  const statuses = {
    NOT_FOUND: 404,
    PREMIUM_REQUIRED: 403,
    IMAGE_TOO_LARGE: 413,
    QUOTA_EXCEEDED: 409,
    BREW_IMAGE_LIMIT: 409,
    UPLOAD_IN_PROGRESS: 409,
    OPERATION_CONFLICT: 409,
    INVALID_IMAGE: 400,
    STORAGE_UNAVAILABLE: 503,
    RATE_LIMITED: 429,
    UPLOAD_FAILED: 500,
  };
  // Never log provider exceptions or signed URLs: they can contain credentials.
  return NextResponse.json(
    { error: code, code },
    { status: statuses[code], headers: brewImageCacheHeaders },
  );
}

/** Bound the stream even when Content-Length is missing or dishonest. */
export async function readImageJson(req: NextRequest) {
  const max = 4_200_000;
  const declared = req.headers.get("content-length");
  if (declared && Number(declared) > max)
    throw new BrewImageError("IMAGE_TOO_LARGE");
  const reader = req.body?.getReader();
  if (!reader) throw new BrewImageError("INVALID_IMAGE");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > max) {
        await reader.cancel();
        throw new BrewImageError("IMAGE_TOO_LARGE");
      }
      chunks.push(value);
    }
    try {
      return JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch {
      throw new BrewImageError("INVALID_IMAGE");
    }
  } finally {
    reader.releaseLock();
  }
}

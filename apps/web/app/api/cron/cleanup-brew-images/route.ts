import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron/authorize-cron";
import { createBrewImageService } from "@/lib/db/brew-images";
export const runtime = "nodejs";
export const maxDuration = 60;
/** Internal maintenance is excluded from public OpenAPI. */
export async function GET(req: NextRequest) {
  if (!isAuthorizedCronRequest(req.headers.get("authorization")))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const result = await createBrewImageService().cleanup();
    if (result.failed)
      console.error("Brew image cleanup needs retry:", result.failed);
    return NextResponse.json(result, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch {
    return NextResponse.json(
      { error: "Brew image cleanup failed" },
      { status: 500 },
    );
  }
}

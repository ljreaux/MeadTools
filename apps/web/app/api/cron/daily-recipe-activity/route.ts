import { NextRequest, NextResponse } from "next/server";
import {
  deleteStaleActivityUpdates,
  sendYesterdayRecipeActivityEmails
} from "@/lib/db/activityEmailUpdates";
import { pingPreview } from "@/lib/db/pingPreviewDb";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", {
      status: 401
    });
  }

  try {
    pingPreview();
    const result = await sendYesterdayRecipeActivityEmails();
    await deleteStaleActivityUpdates();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("Error in daily recipe activity cron:", error);
    return NextResponse.json(
      { ok: false, error: "Cron failed" },
      { status: 500 }
    );
  }
}

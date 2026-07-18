import { NextRequest, NextResponse } from "next/server";

import { rebuildEstimatedAbvEntriesForBrew } from "@/lib/db/brews";
import prisma from "@/lib/prisma";
import { verifyAdmin } from "@/lib/userAccessFunctions";

const BATCH_SIZE = 10;

type RebuildRequest = {
  scope?: unknown;
  brewId?: unknown;
  dryRun?: unknown;
  cursor?: unknown;
};

export async function POST(req: NextRequest) {
  const adminOrResponse = await verifyAdmin(req);
  if (adminOrResponse instanceof NextResponse) return adminOrResponse;

  let body: RebuildRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const scope = body.scope === "all" ? "all" : "brew";
  const dryRun = body.dryRun === true;
  const brewId = typeof body.brewId === "string" ? body.brewId.trim() : "";
  const cursor = typeof body.cursor === "string" ? body.cursor : undefined;

  if (scope === "brew") {
    if (!brewId) {
      return NextResponse.json({ error: "A brew ID is required." }, { status: 400 });
    }

    const brew = await prisma.brews.findFirst({
      where: { id: brewId, user_id: { not: null } },
      select: { id: true }
    });
    if (!brew) {
      return NextResponse.json({ error: "Brew not found." }, { status: 404 });
    }

    if (!dryRun) await rebuildEstimatedAbvEntriesForBrew(brew.id);

    return NextResponse.json({
      scope,
      dryRun,
      total: 1,
      processed: dryRun ? 0 : 1,
      remaining: dryRun ? 1 : 0,
      nextCursor: null
    });
  }

  const where = { user_id: { not: null } };
  const total = await prisma.brews.count({ where });
  if (dryRun) {
    return NextResponse.json({
      scope,
      dryRun: true,
      total,
      processed: 0,
      remaining: total,
      nextCursor: null
    });
  }

  const rows = await prisma.brews.findMany({
    where,
    cursor: cursor ? { id: cursor } : undefined,
    skip: cursor ? 1 : 0,
    take: BATCH_SIZE + 1,
    orderBy: { id: "asc" },
    select: { id: true }
  });
  const batch = rows.slice(0, BATCH_SIZE);

  for (const brew of batch) {
    await rebuildEstimatedAbvEntriesForBrew(brew.id);
  }

  return NextResponse.json({
    scope,
    dryRun: false,
    total,
    processed: batch.length,
    remaining: Math.max(total - batch.length, 0),
    nextCursor: rows.length > BATCH_SIZE ? batch.at(-1)?.id ?? null : null
  });
}

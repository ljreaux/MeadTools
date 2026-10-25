"use server";

import { NextRequest } from "next/server";
import { generateOwnedBrewQr, type BrewQrResult } from "@meadtools/brew-domain/qr";
import { isBrewLinkId } from "@meadtools/brew-domain/links";
import { verifyUser } from "@/lib/userAccessFunctions";
import { getPremiumAccessStatus } from "@/lib/db/premium-access";
import prisma from "@/lib/prisma";

export async function generateBrewQr(brewId: string, bearer: string | null): Promise<BrewQrResult> {
  if (!isBrewLinkId(brewId) ||
      (bearer !== null && (typeof bearer !== "string" || bearer.length > 16_384 || /[\r\n]/.test(bearer)))) {
    return { error: "unavailable" };
  }
  try {
    // Reuse both legacy bearer authentication and the normal NextAuth session.
    const userId = await verifyUser(new NextRequest("https://meadtools.com", {
      headers: bearer ? { Authorization: `Bearer ${bearer}` } : {},
    }));
    if (typeof userId !== "number") return { error: "unavailable" };
    return await generateOwnedBrewQr(brewId, {
      publicBaseUrl: process.env.NEXT_PUBLIC_BASE_URL ?? "https://meadtools.com",
      ownsBrew: async (id) => Boolean(await prisma.brews.findFirst({
        where: { id, user_id: userId }, select: { id: true },
      })),
      premiumEnabled: async () => (await getPremiumAccessStatus(userId)).premiumEnabled,
    });
  } catch {
    return { error: "failed" };
  }
}

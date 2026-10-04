import prisma from "@/lib/prisma";
import { randomBytes } from "node:crypto";
import type { ReleaseEmailPreferencesUpdateBody } from "@meadtools/api-contract/contracts";
import {
  consentDates,
  releaseEmailResponse,
} from "@/lib/release-email-consent";

export async function getReleaseEmailPreferences(userId: number) {
  const row = await prisma.release_email_preferences.findUnique({
    where: { user_id: userId },
  });
  return releaseEmailResponse(row);
}

export async function setReleaseEmailPreferences(
  userId: number,
  requested: ReleaseEmailPreferencesUpdateBody,
) {
  return prisma.$transaction(async (tx) => {
    const previous = await tx.release_email_preferences.findUnique({
      where: { user_id: userId },
    });
    const dates = consentDates(previous, requested, new Date());
    const row = await tx.release_email_preferences.upsert({
      where: { user_id: userId },
      create: {
        user_id: userId,
        unsubscribe_token: randomBytes(32).toString("hex"),
        ...dates,
      },
      update: dates,
    });
    return releaseEmailResponse(row);
  });
}

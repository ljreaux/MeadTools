import prisma from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { sendEmail } from "@/lib/db/emailHelpers";
import { getDatedReleases } from "@/lib/release-notes";
import {
  composeProductUpdateEmail,
  eligibleProductUpdateRelease,
  productUpdateMailingAddress,
} from "@/lib/product-update-email";

export async function sendPendingProductUpdates() {
  if (!productUpdateMailingAddress.trim())
    return { status: "postal-address-needed", sent: 0, failed: 0 };
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS || !process.env.NEXTAUTH_SECRET)
    return { status: "sender-configuration-needed", sent: 0, failed: 0 };

  const release = eligibleProductUpdateRelease(await getDatedReleases());
  if (!release) return { status: "no-eligible-release", sent: 0, failed: 0 };
  const releaseDate = new Date(`${release.date}T00:00:00.000Z`);
  const eligible: Prisma.usersWhereInput = {
    active: true,
    product_updates_opt_in: true,
    OR: [
      { product_updates_last_emailed_date: null },
      { product_updates_last_emailed_date: { lt: releaseDate } },
    ],
  };
  const users = await prisma.users.findMany({
    where: eligible,
    select: { id: true, email: true },
    orderBy: { id: "asc" },
    take: 10,
  });
  let sent = 0;
  let failed = 0;
  for (const user of users) {
    const claimed = await prisma.users.updateMany({
      where: { id: user.id, ...eligible },
      data: { product_updates_last_emailed_date: releaseDate },
    });
    if (claimed.count !== 1) continue;
    // Recheck just before SMTP so a recent account opt-out is respected.
    const current = await prisma.users.findUnique({
      where: { id: user.id },
      select: { active: true, product_updates_opt_in: true },
    });
    if (!current?.active || current.product_updates_opt_in !== true) continue;
    try {
      await sendEmail({ to: user.email, fromName: "MeadTools", ...composeProductUpdateEmail(release, user.id) });
      sent++;
    } catch {
      failed++;
    }
  }
  return { status: "processed", sent, failed };
}

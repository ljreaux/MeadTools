import prisma from "@/lib/prisma";
import { sendEmail } from "@/lib/db/emailHelpers";
import { getDatedReleases } from "@/lib/release-notes";
import {
  productionReleaseEmailConfig,
  renderReleaseEmail,
  type ReleaseEmailProduct,
} from "@/lib/release-email-content";
import type { release_email_product } from "@prisma/client";

const columns = {
  web: "web_opted_in_at",
  mobile: "mobile_opted_in_at",
  chat: "chat_opted_in_at",
  api: "api_opted_in_at",
} as const;
const enumProducts = {
  web: "WEB",
  mobile: "MOBILE",
  chat: "CHAT",
  api: "API",
} as const satisfies Record<ReleaseEmailProduct, release_email_product>;

async function releaseFor(date: string, product: ReleaseEmailProduct) {
  const release = (await getDatedReleases()).find((item) => item.date === date);
  if (!release?.content.products[product]?.items.length) {
    throw new Error("This release has no shipped notes for the selected product.");
  }
  return release.content;
}

export async function releaseEmailOverview() {
  const releases = await getDatedReleases();
  const available = releases.map(({ date, content }) => ({
    date,
    title: content.title,
    products: (Object.keys(columns) as ReleaseEmailProduct[]).filter(
      (product) => !!content.products[product]?.items.length,
    ),
  }));
  const counts = await prisma.release_email_deliveries.groupBy({
    by: ["release_date", "product", "status"],
    _count: { _all: true },
  });
  return {
    available,
    counts: counts.map((row) => ({
      date: row.release_date.toISOString().slice(0, 10),
      product: row.product.toLowerCase() as ReleaseEmailProduct,
      status: row.status,
      count: row._count._all,
    })),
  };
}

export async function prepareReleaseEmails(date: string, product: ReleaseEmailProduct) {
  productionReleaseEmailConfig();
  await releaseFor(date, product);
  const releaseDate = new Date(`${date}T00:00:00.000Z`);
  const recipients = await prisma.release_email_preferences.findMany({
    where: { [columns[product]]: { not: null }, user: { active: true } },
    select: { user_id: true },
  });
  if (recipients.length) {
    await prisma.release_email_deliveries.createMany({
      data: recipients.map(({ user_id }) => ({
        release_date: releaseDate,
        product: enumProducts[product],
        user_id,
      })),
      skipDuplicates: true,
    });
  }
  return releaseEmailOverview();
}

type Claim = { id: string; user_id: number };

async function claimNext(date: string, product: ReleaseEmailProduct): Promise<Claim | null> {
  return prisma.$transaction(async (tx) => {
    // Serialize claims across every release/product so concurrent admins stay
    // below the existing Office 365 SMTP account's submission limit.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(74130819)`;
    const recent = await tx.release_email_deliveries.count({
      where: { claimed_at: { gte: new Date(Date.now() - 60_000) } },
    });
    if (recent >= 20) return null;
    const row = await tx.release_email_deliveries.findFirst({
      where: {
        release_date: new Date(`${date}T00:00:00.000Z`),
        product: enumProducts[product],
        status: "PENDING",
      },
      orderBy: { prepared_at: "asc" },
      select: { id: true, user_id: true },
    });
    if (!row) return null;
    await tx.release_email_deliveries.update({
      where: { id: row.id },
      data: { status: "SENDING", claimed_at: new Date() },
    });
    return row;
  });
}

export async function sendReleaseEmailBatch(date: string, product: ReleaseEmailProduct) {
  const { baseUrl, postalAddress } = productionReleaseEmailConfig();
  const entry = await releaseFor(date, product);
  let sent = 0;
  let failed = 0;
  let skipped = 0;
  for (let index = 0; index < 10; index += 1) {
    const claim = await claimNext(date, product);
    if (!claim) break;
    try {
      // Consent is read at send time, after the delivery row has been claimed.
      const user = await prisma.users.findUnique({
        where: { id: claim.user_id },
        select: {
          email: true,
          active: true,
          release_email_preferences: {
            select: {
              unsubscribe_token: true,
              [columns[product]]: true,
            },
          },
        },
      });
      const consent = user?.release_email_preferences;
      if (!user?.active || !consent?.[columns[product]]) {
        await prisma.release_email_deliveries.update({
          where: { id: claim.id },
          data: { status: "SKIPPED" },
        });
        skipped += 1;
        continue;
      }
      const email = renderReleaseEmail({
        date,
        product,
        entry,
        baseUrl,
        postalAddress,
        unsubscribeToken: consent.unsubscribe_token,
      });
      const result = await sendEmail({
        to: user.email,
        fromName: "MeadTools",
        ...email,
      });
      await prisma.release_email_deliveries.update({
        where: { id: claim.id },
        data: { status: "SENT", sent_at: new Date(), message_id: result.messageId },
      });
      sent += 1;
    } catch {
      // Never retry an uncertain SMTP outcome automatically.
      console.error("Release email delivery failed.", { deliveryId: claim.id });
      await prisma.release_email_deliveries.update({
        where: { id: claim.id },
        data: { status: "FAILED" },
      });
      failed += 1;
    }
  }
  return { sent, failed, skipped, ...(await releaseEmailOverview()) };
}

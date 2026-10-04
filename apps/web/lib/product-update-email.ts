import type { getDatedReleases } from "@/lib/release-notes";
import { productUpdateUnsubscribeToken } from "@/lib/release-email-token";

type Release = Awaited<ReturnType<typeof getDatedReleases>>[number];
const shippedProducts = ["web", "mobile", "chat", "api"] as const;
const labels = {
  web: "Web",
  mobile: "Mobile",
  chat: "Chat assistant",
  api: "API and integrations",
};

// Add the verified MeadTools postal address here before enabling release mail.
// It is intentionally versioned configuration, not another environment variable.
export const productUpdateMailingAddress = "";

export function eligibleProductUpdateRelease(
  releases: Release[],
  now = new Date(),
): Release | null {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = (type: string) => parts.find((part) => part.type === type)?.value;
  const today = `${value("year")}-${value("month")}-${value("day")}`;
  const earliest = new Date(`${today}T00:00:00Z`);
  earliest.setUTCDate(earliest.getUTCDate() - 7);
  const firstDay = earliest.toISOString().slice(0, 10);
  return releases.find(({ date, content }) =>
    date >= firstDay &&
    date <= today &&
    shippedProducts.some((product) => content.products[product]?.items.length),
  ) ?? null;
}

export function composeProductUpdateEmail(release: Release, userId: number) {
  const baseUrl = (process.env.NEXT_PUBLIC_BASE_URL || "https://meadtools.com").replace(/\/$/, "");
  const sections = shippedProducts.flatMap((product) => {
    const items = release.content.products[product]?.items;
    return items?.length ? [`${labels[product]}:\n${items.map((item) => `- ${item}`).join("\n")}`] : [];
  });
  const unsubscribeUrl = `${baseUrl}/release-emails/unsubscribe?token=${encodeURIComponent(productUpdateUnsubscribeToken(userId))}`;
  return {
    subject: `MeadTools product update — ${release.content.title}`,
    text: [
      release.content.summary,
      ...sections,
      `Full release notes: ${baseUrl}/release-notes/${release.date}`,
      `Unsubscribe: ${unsubscribeUrl}`,
      `MeadTools\n${productUpdateMailingAddress}`,
    ].join("\n\n"),
  };
}

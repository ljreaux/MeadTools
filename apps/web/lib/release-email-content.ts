import type { ReleaseEmailPreferencesUpdateBody } from "@meadtools/api-contract/contracts";

export type ReleaseEmailProduct = keyof ReleaseEmailPreferencesUpdateBody;

const labels: Record<ReleaseEmailProduct, string> = {
  web: "Web",
  mobile: "Mobile",
  chat: "Chat assistant",
  api: "API and integrations",
};

type ReleaseEntry = {
  title: string;
  products: Partial<Record<ReleaseEmailProduct, { items: string[] }>>;
};

export function renderReleaseEmail({
  date,
  product,
  entry,
  baseUrl,
  postalAddress,
  unsubscribeToken,
}: {
  date: string;
  product: ReleaseEmailProduct;
  entry: ReleaseEntry;
  baseUrl: string;
  postalAddress: string;
  unsubscribeToken: string;
}) {
  const section = entry.products[product];
  if (!section?.items.length) throw new Error("No shipped notes for this product.");
  if (!postalAddress.trim()) throw new Error("Release email postal address is required.");
  if (!/^[a-f0-9]{64}$/.test(unsubscribeToken)) throw new Error("Invalid unsubscribe token.");
  const notesUrl = new URL(`/release-notes/${date}`, baseUrl);
  const unsubscribeUrl = new URL("/release-emails/unsubscribe", baseUrl);
  unsubscribeUrl.searchParams.set("token", unsubscribeToken);
  unsubscribeUrl.searchParams.set("product", product);
  const subject = `MeadTools ${labels[product]} update — ${entry.title}`;
  const text = [
    `${labels[product]} updates:`,
    ...section.items.map((item) => `• ${item}`),
    `Full release notes: ${notesUrl}`,
    `You received this because you opted in to ${labels[product]} release announcements.`,
    `Unsubscribe from ${labels[product]} release emails: ${unsubscribeUrl}`,
    `MeadTools mailing address: ${postalAddress.trim()}`,
  ].join("\n\n");
  return { subject, text };
}

export function productionReleaseEmailConfig() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const postalAddress = process.env.RELEASE_EMAIL_POSTAL_ADDRESS?.trim();
  if (
    process.env.VERCEL_ENV !== "production" ||
    !baseUrl ||
    !["https://meadtools.com", "https://www.meadtools.com"].includes(
      baseUrl.replace(/\/$/, ""),
    )
  ) {
    throw new Error("Release email dispatch is restricted to the MeadTools production origin.");
  }
  if (!postalAddress || !process.env.EMAIL_USER?.trim() || !process.env.EMAIL_PASS?.trim()) {
    throw new Error("Release email sender configuration is incomplete.");
  }
  return { baseUrl, postalAddress };
}

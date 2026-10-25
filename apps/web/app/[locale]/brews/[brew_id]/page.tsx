import { notFound, redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { resolveBrewQrDestination } from "@/lib/brews/qrDestination";
import { isBrewLinkId } from "@meadtools/brew-domain/links";

// Sharing changes and deletion must take effect on the next scan.
export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

export default async function BrewQrDestination({
  params,
}: {
  params: Promise<{ locale: string; brew_id: string }>;
}) {
  const { locale, brew_id } = await params;
  if (!isBrewLinkId(brew_id)) notFound();
  redirect(await resolveBrewQrDestination(prisma, brew_id, locale));
}

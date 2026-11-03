/** Private CSV reconciliation. Load the explicitly authorized runtime externally. */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import prisma from "../lib/prisma";
import { kofiEmailDigest, recordKofiSubscriptionPayment } from "../lib/billing/kofi-premium";
import { buildKofiImportPlan, KOFI_LAUNCH, KOFI_PROMO_END } from "../lib/billing/kofi-import";

const args = process.argv.slice(2);
function option(name: string) {
  const i = args.indexOf(name);
  if (i < 0 || !args[i + 1] || args[i + 1].startsWith("--")) throw new Error(`Missing ${name}`);
  return args[i + 1];
}

async function main() {
  const members = option("--members");
  const payments = option("--payments");
  const reportPath = resolve(option("--report"));
  execFileSync("git", ["check-ignore", "--quiet", reportPath]);
  if (!process.env.KOFI_EMAIL_DIGEST_SECRET) throw new Error("Ko-fi email digest configuration is missing.");
  const expectedRef = option("--expected-project-ref");
  const url = new URL(process.env.DATABASE_URL!);
  if (!(url.hostname === `db.${expectedRef}.supabase.co` || decodeURIComponent(url.username) === `postgres.${expectedRef}`))
    throw new Error("Database identity does not match the explicitly selected Supabase project.");
  const now = new Date();
  const plan = buildKofiImportPlan(readFileSync(members, "utf8"), readFileSync(payments, "utf8"), now);
  const apply = args.includes("--apply");
  const links = await prisma.premium_kofi_links.findMany({ select: { user_id: true, email_digest: true } });
  const linked = new Map(links.map(link => [link.email_digest, link.user_id]));
  const promotions: { email: string; userId: number | null; status: string }[] = [];
  let imported = 0;
  let duplicate = 0;
  if (apply) {
    await prisma.premium_kofi_links.updateMany({
      where: { email_digest: { in: plan.legacyEmails.map(kofiEmailDigest) } },
      data: { grandfathered: true },
    });
    for (const payment of plan.recurring) {
      const result = await recordKofiSubscriptionPayment({ ...payment,
        messageId: `kofi-csv:${payment.transactionId}`, verificationToken: "authorized-private-csv-import" }, now);
      if (result.duplicate) duplicate++; else imported++;
    }
  }
  for (const email of plan.promotionalEmails) {
    const userId = linked.get(kofiEmailDigest(email)) ?? null;
    let status = userId == null ? "awaiting-verified-account-link" : now < KOFI_LAUNCH ? "awaiting-November-9" : "ready";
    if (now >= KOFI_PROMO_END) status = "offer-ended";
    if (apply && status === "ready" && userId !== null) {
      status = await prisma.$transaction(async tx => {
        await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;
        const user = await tx.users.findUnique({ where: { id: userId }, select: { active: true, credit_account: { select: { payment_restricted_at: true } } } });
        if (!user?.active || user.credit_account?.payment_restricted_at) return "account-unavailable";
        const current = await tx.premium_memberships.findUnique({ where: { user_id_source: { user_id: userId, source: "manual" } } });
        if (current?.revoked_at) return "manual-review-revoked-membership";
        if (current && current.paid_through >= KOFI_PROMO_END) return "existing-access-preserved";
        await tx.premium_memberships.upsert({
          where: { user_id_source: { user_id: userId, source: "manual" } },
          create: { user_id: userId, source: "manual", external_reference: `kofi-one-time-2026:${userId}`, paid_through: KOFI_PROMO_END },
          update: { paid_through: KOFI_PROMO_END },
        });
        // This promotion intentionally makes no credit-ledger grant.
        return "granted-premium-only";
      });
    }
    promotions.push({ email, userId, status });
  }
  const summary = { apply, legacyMembers: plan.legacyEmails.length, recurringPaymentRows: plan.recurring.length,
    imported, duplicate, promotionalPayers: promotions.length,
    verifiedPromotionalLinks: promotions.filter(p => p.userId !== null).length,
    promotionalGrants: promotions.filter(p => p.status === "granted-premium-only").length };
  mkdirSync(dirname(reportPath), { recursive: true, mode: 0o700 });
  writeFileSync(reportPath, JSON.stringify({ generatedAt: now, summary, promotions, legacyEmails: plan.legacyEmails }, null, 2) + "\n", { mode: 0o600 });
  console.log(JSON.stringify(summary));
}

try { await main(); }
catch { console.error("Ko-fi reconciliation stopped. Check private input, runtime configuration and project identity; no credentials or payer details are logged. Completed payment imports are idempotent and safe to resume."); process.exitCode = 1; }
finally { await prisma.$disconnect(); }

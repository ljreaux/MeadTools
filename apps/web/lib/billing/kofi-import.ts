import { parse } from "csv-parse/sync";

export const KOFI_LAUNCH = new Date("2026-11-09T06:00:00.000Z");
export const KOFI_PROMO_END = new Date("2027-02-09T06:00:00.000Z");

function utcDate(value: string, membership = false) {
  const match = value.trim().match(membership
    ? /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})(?::(\d{2}))?$/
    : /^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) throw new Error("Unsupported Ko-fi export timestamp format.");
  const [, a, b, c, h, m, s = "0"] = match;
  const year = Number(membership ? a : c);
  const month = Number(membership ? b : a);
  const day = Number(membership ? c : b);
  const date = new Date(Date.UTC(year, month - 1, day, Number(h), Number(m), Number(s)));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day ||
      date.getUTCHours() !== Number(h) || date.getUTCMinutes() !== Number(m) || date.getUTCSeconds() !== Number(s))
    throw new Error("Invalid Ko-fi export timestamp.");
  return date;
}

const email = (value: string) => {
  const normalized = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) throw new Error("Invalid payer email in Ko-fi export.");
  return normalized;
};

export function buildKofiImportPlan(membersCsv: string, paymentsCsv: string, now = new Date()) {
  const read = (text: string): Record<string, string>[] => parse(text, { columns: true, bom: true, skip_empty_lines: true });
  const members = read(membersCsv);
  const payments = read(paymentsCsv);
  if (members.some(row => !["True", "False"].includes(row.IsActive))) throw new Error("Invalid member export.");
  const legacyEmails = new Set(members.filter(row => row.IsActive === "True" && utcDate(row.SinceDateUTC, true) < KOFI_LAUNCH).map(row => email(row.Email)));
  const seen = new Set<string>();
  const recurring: { email: string; transactionId: string; paidAt: Date; amountCents: number; currency: string }[] = [];
  const promotionalEmails = new Set<string>();
  for (const row of payments) {
    if (!["Tip", "Monthly Tip"].includes(row.TransactionType)) continue;
    if (!/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(row.TransactionId)) throw new Error("Invalid transaction identity in Ko-fi export.");
    if (seen.has(row.TransactionId)) throw new Error("Duplicate transaction identity in Ko-fi export.");
    seen.add(row.TransactionId);
    const paidAt = utcDate(row["DateTime (UTC)"]);
    if (paidAt > now) throw new Error("Ko-fi export contains future payments.");
    const payer = email(row.BuyerEmail);
    if (!/^\d+(?:\.\d{1,2})?$/.test(row.Received) || !/^\d+(?:\.\d{1,2})?$/.test(row.Given)) throw new Error("Invalid Ko-fi payment amount.");
    // Ko-fi's account export includes outgoing support in Given. Only incoming
    // Received amounts are evidence of support for MeadTools.
    if (Number(row.Received) === 0) continue;
    if (Number(row.Given) > 0) throw new Error("Review ambiguous incoming/outgoing Ko-fi payment.");
    const amountCents = Math.round(Number(row.Received) * 100);
    if (!Number.isSafeInteger(amountCents) || amountCents <= 0) throw new Error("Invalid Ko-fi payment amount.");
    if (row.Currency !== "USD") throw new Error("Review non-USD payment before import.");
    if (row.TransactionType === "Monthly Tip" && legacyEmails.has(payer) && paidAt < KOFI_LAUNCH)
      recurring.push({ email: payer, transactionId: row.TransactionId, paidAt, amountCents, currency: "usd" });
    if (row.TransactionType === "Tip" && !legacyEmails.has(payer) && paidAt < KOFI_LAUNCH &&
        paidAt.getTime() >= KOFI_LAUNCH.getTime() - 90 * 24 * 60 * 60_000)
      promotionalEmails.add(payer);
  }
  return { legacyEmails: [...legacyEmails], recurring, promotionalEmails: [...promotionalEmails] };
}

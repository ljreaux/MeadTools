type StoredPayment = { message_id: string; transaction_id: string; email_digest: string; amount_cents: number; currency: string; paid_at: Date };
type IncomingPayment = { messageId: string; transactionId: string; amountCents: number; currency: string; paidAt: Date };

/** CSV exports omit webhook message IDs and timestamp seconds. */
export function sameImportedKofiPayment(stored: StoredPayment, incoming: IncomingPayment, digest: string) {
  return (stored.message_id.startsWith("kofi-csv:") || incoming.messageId.startsWith("kofi-csv:")) &&
    stored.transaction_id === incoming.transactionId && stored.email_digest === digest &&
    stored.amount_cents === incoming.amountCents && stored.currency === incoming.currency &&
    Math.floor(stored.paid_at.getTime() / 60_000) === Math.floor(incoming.paidAt.getTime() / 60_000);
}

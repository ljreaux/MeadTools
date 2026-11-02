/** Simulate one Ko-fi $5 monthly payment for a payer address you control. */
import { randomUUID } from "node:crypto";
import { createInterface } from "node:readline/promises";

const databaseUrl = process.env.DATABASE_URL;
const token = process.env.KOFI_VERIFICATION_TOKEN;
if (!databaseUrl || !["localhost", "127.0.0.1"].includes(new URL(databaseUrl).hostname)) {
  throw new Error("This helper only runs against the local development database.");
}
if (!token) throw new Error("The local Ko-fi verification token is missing.");

const input = createInterface({ input: process.stdin, output: process.stdout });
let email: string;
try {
  email = (await input.question("Ko-fi payer email for this local test: ")).trim();
} finally {
  input.close();
}
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 255) {
  throw new Error("Enter a valid payer email.");
}

const id = `local-premium-${randomUUID()}`;
const payload = {
  verification_token: token,
  message_id: id,
  kofi_transaction_id: id,
  timestamp: new Date().toISOString(),
  type: "Subscription",
  is_subscription_payment: true,
  is_first_subscription_payment: true,
  email,
  amount: "5.00",
  currency: "USD",
};
const response = await fetch("http://localhost:3000/api/webhooks/kofi", {
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ data: JSON.stringify(payload) }),
});
if (!response.ok) throw new Error(`Local Ko-fi test returned HTTP ${response.status}.`);
console.log("Local Ko-fi payment test recorded. Refresh the premium and credit pages.");

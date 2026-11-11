import { deliverDuePremiumAllowances } from "../lib/billing/premium-allowances";
import prisma from "../lib/prisma";

const database = new URL(process.env.DATABASE_URL ?? "http://invalid");
if (!["localhost", "127.0.0.1"].includes(database.hostname)) {
  throw new Error("This local delivery command requires a local database.");
}
try {
  console.log(await deliverDuePremiumAllowances());
} finally {
  await prisma.$disconnect();
}

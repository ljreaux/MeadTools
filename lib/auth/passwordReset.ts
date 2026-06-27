import jwt from "jsonwebtoken";

import { escapeHtml, sendEmail } from "@/lib/db/emailHelpers";

export async function sendPasswordResetEmail({
  userId,
  email
}: {
  userId: number;
  email: string;
}) {
  const secret = process.env.RESET_PASSWORD_SECRET;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

  if (!secret || !baseUrl) {
    throw new Error("Password reset email is not configured.");
  }

  const token = jwt.sign({ userId }, secret, { expiresIn: "15m" });
  const resetUrl = `${baseUrl}/reset-password?token=${encodeURIComponent(token)}`;
  const safeResetUrl = escapeHtml(resetUrl);

  await sendEmail({
    to: email,
    fromName: "MeadTools",
    subject: "Reset your MeadTools password",
    text: `Reset your MeadTools password using this link: ${resetUrl}\n\nThis link expires in 15 minutes.`,
    html: `
      <p>Click the link below to reset your password:</p>
      <p><a href="${safeResetUrl}">Reset your password</a></p>
      <p>This link will expire in 15 minutes.</p>
    `
  });
}

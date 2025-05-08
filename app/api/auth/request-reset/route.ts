import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import { getUserByEmail } from "@/lib/db/users";

const {
  RESET_PASSWORD_SECRET = "",
  EMAIL_USER,
  EMAIL_PASS,
  NEXT_PUBLIC_BASE_URL,
} = process.env;

export async function POST(req: NextRequest) {
  const { email } = await req.json();

  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  const user = await getUserByEmail(email);
  if (!user) {
    // Do not reveal if the user exists
    return NextResponse.json({
      message: "If that email exists, a reset link has been sent.",
    });
  }

  const token = jwt.sign({ userId: user.id }, RESET_PASSWORD_SECRET, {
    expiresIn: "15m",
  });

  const resetUrl = `${NEXT_PUBLIC_BASE_URL}/reset-password?token=${token}`;

  const transporter = nodemailer.createTransport({
    host: "smtp.office365.com",
    port: 587,
    secure: false,
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASS,
    },
  });

  await transporter.sendMail({
    to: email,
    from: EMAIL_USER,
    subject: "Reset your MeadTools password",
    html: `
      <p>Click the link below to reset your password:</p>
      <p><a href="${resetUrl}">${resetUrl}</a></p>
      <p>This link will expire in 15 minutes.</p>
    `,
  });

  return NextResponse.json({ message: "Reset link sent." });
}

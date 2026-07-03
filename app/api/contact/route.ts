import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

/**
 * Send contact message
 * @description Sends a contact form message to the MeadTools support inbox.
 * @body ContactRequestBody
 * @response 200:ContactSuccessResponse
 * @responseSet none
 * @add 400:ContactValidationErrorResponse
 * @add 500:ContactSendErrorResponse
 * @tag Contact
 * @openapi
 */
export async function POST(req: Request) {
  const { user_name, user_email, message } = await req.json();

  if (!user_name || !user_email || !message) {
    return NextResponse.json(
      { message: "All fields are required" },
      { status: 400 }
    );
  }

  const transporter = nodemailer.createTransport({
    host: "smtp.office365.com", // Microsoft 365 SMTP host
    port: 587, // SMTP port for TLS
    secure: false, // Use STARTTLS
    auth: {
      user: process.env.EMAIL_USER, // Your Microsoft 365 email address
      pass: process.env.EMAIL_PASS, // Your Microsoft 365 app password
    },
  });

  try {
    await transporter.sendMail({
      from: `"Contact Form" <${process.env.EMAIL_USER}>`, // Sender
      to: "contact@meadtools.com", // Recipient
      subject: `New message from ${user_name}`, // Subject line
      text: `You have a new message:\n\nName: ${user_name}\nEmail: ${user_email}\n\n${message}`, // Plain text body
    });

    return NextResponse.json({ message: "Email sent successfully" });
  } catch (error) {
    console.error("Error sending email:", error);
    return NextResponse.json(
      { message: "Failed to send email" },
      { status: 500 }
    );
  }
}

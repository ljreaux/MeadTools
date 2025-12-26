import nodemailer from "nodemailer";

export const escapeHtml = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const IMAGE_MD_REGEX = new RegExp("!\\[[^\\]]*]\\([^)]*\\)", "g");
const LINK_MD_REGEX = new RegExp("\\[([^\\]]+)]\\([^)]*\\)", "g");

export function stripMarkdown(md: string): string {
  return (
    md
      // Remove code fences ```...``` (multiline)
      .replace(/```[\s\S]*?```/g, "")

      // Remove inline code `code`
      .replace(/`[^`]*`/g, "")

      // Remove images entirely: ![alt](url)
      .replace(IMAGE_MD_REGEX, "")

      // Links: [text](url) -> text
      .replace(LINK_MD_REGEX, "$1")

      // Bold/italic: *, **, ***, _, __, ___ -> keep inner text
      .replace(/(\*{1,3}|_{1,3})(.*?)\1/g, "$2")

      // Blockquotes: remove leading ">"
      .replace(/^>\s?/gm, "")

      // Headings: "# " etc.
      .replace(/^\s{0,3}#{1,6}\s+/gm, "")

      // Collapse whitespace
      .replace(/\s+/g, " ")
      .trim()
  );
}

export async function sendEmail({
  to,
  subject,
  text,
  html
}: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}) {
  const user = process.env.EMAIL_USER!;
  const pass = process.env.EMAIL_PASS!;

  const transporter = nodemailer.createTransport({
    host: "smtp.office365.com",
    port: 587,
    secure: false,
    requireTLS: true,
    auth: { user, pass }
  });

  await transporter.sendMail({
    from: { name: "MeadTools Alerts", address: user },
    to,
    subject,
    text,
    html
  });
}

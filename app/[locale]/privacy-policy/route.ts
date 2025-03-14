import { promises as fs } from "fs";
import { NextResponse } from "next/server";
import path from "path";

export async function GET() {
  const filePath = path.join(process.cwd(), "public", "privacy-policy.html");
  const fileContents = await fs.readFile(filePath, "utf8");

  return new NextResponse(fileContents, {
    headers: { "Content-Type": "text/html" },
  });
}

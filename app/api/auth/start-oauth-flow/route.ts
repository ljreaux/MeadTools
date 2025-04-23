// app/api/auth/start-desktop-oauth/route.ts
import { NextResponse } from "next/server";

export async function GET() {
  const clientId = process.env.GOOGLE_CLIENT_ID!;
  const redirectUri = `${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/oauth-callback`;
  const scope = "openid email profile";

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", scope);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");

  return NextResponse.redirect(url.toString());
}

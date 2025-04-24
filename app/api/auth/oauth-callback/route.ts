import { NextRequest, NextResponse } from "next/server";
const { NEXT_PUBLIC_BASE_URL = "" } = process.env;

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");

  if (!code) {
    return NextResponse.redirect("http://localhost:8080/?error=missing_code");
  }

  const redirectUri = `${NEXT_PUBLIC_BASE_URL}/api/auth/oauth-callback`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  const tokenData = await tokenRes.json();

  if (!tokenRes.ok) {
    return NextResponse.redirect(
      "http://localhost:8080/?error=token_exchange_failed"
    );
  }

  // Send access_token to verify-token API
  const verifyRes = await fetch(
    `${NEXT_PUBLIC_BASE_URL}/api/auth/verify-token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: tokenData.access_token,
        provider: "google",
        email: tokenData.id_token
          ? parseJwt(tokenData.id_token).email
          : undefined, // optional
      }),
    }
  );

  const verifyData = await verifyRes.json();

  if (!verifyRes.ok) {
    return NextResponse.redirect(
      `http://localhost:8080/?error=verification_failed`
    );
  }

  return NextResponse.redirect(
    `http://localhost:8080/?token=${verifyData.token}`
  );
}

// Utility for decoding ID tokens
function parseJwt(token: string) {
  try {
    return JSON.parse(Buffer.from(token.split(".")[1], "base64").toString());
  } catch {
    return {};
  }
}

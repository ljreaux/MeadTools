import { isAllowedGoogleAudience } from "./google-audience";

type GoogleTokenClient = {
  getTokenInfo(token: string): Promise<{
    aud: string;
    email?: string;
    email_verified?: boolean;
  }>;
  verifyIdToken(options: {
    audience: string[];
    idToken: string;
  }): Promise<{
    getPayload(): { email?: string; email_verified?: boolean } | undefined;
  }>;
};

export async function verifyGoogleTokenEmail({
  allowedAudiences,
  client,
  token
}: {
  allowedAudiences: string[];
  client: GoogleTokenClient;
  token: string;
}) {
  if (allowedAudiences.length === 0) {
    throw new Error("No Google OAuth client IDs are configured");
  }

  if (token.startsWith("ya29.")) {
    const tokenInfo = await client.getTokenInfo(token);

    if (
      !isAllowedGoogleAudience(tokenInfo.aud, allowedAudiences) ||
      !tokenInfo.email ||
      tokenInfo.email_verified === false
    ) {
      return null;
    }

    return tokenInfo.email;
  }

  const ticket = await client.verifyIdToken({
    idToken: token,
    audience: allowedAudiences
  });
  const payload = ticket.getPayload();

  if (!payload?.email || payload.email_verified === false) {
    return null;
  }

  return payload.email;
}

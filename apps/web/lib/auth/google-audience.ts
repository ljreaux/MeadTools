type GoogleAudienceEnvironment = {
  [key: string]: string | undefined;
  GOOGLE_ANDROID_CLIENT_ID?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_IOS_CLIENT_ID?: string;
};

export function getAllowedGoogleAudiences(
  environment: GoogleAudienceEnvironment = process.env
) {
  return Array.from(
    new Set(
      [
        environment.GOOGLE_CLIENT_ID,
        environment.GOOGLE_IOS_CLIENT_ID,
        environment.GOOGLE_ANDROID_CLIENT_ID
      ].filter((clientId): clientId is string => Boolean(clientId))
    )
  );
}

export function isAllowedGoogleAudience(
  audience: string,
  allowedAudiences: readonly string[]
) {
  return allowedAudiences.includes(audience);
}

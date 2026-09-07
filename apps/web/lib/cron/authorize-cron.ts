import "server-only";

/**
 * Cron endpoints are privileged maintenance entry points. A missing secret is
 * a configuration error, never a value that can be authenticated as
 * `Bearer undefined`.
 */
export function isAuthorizedCronRequest(
  authorization: string | null,
  secret = process.env.CRON_SECRET,
): boolean {
  const configuredSecret = secret?.trim();
  if (!configuredSecret) return false;
  return authorization === `Bearer ${configuredSecret}`;
}

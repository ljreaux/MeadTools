export function isAccessTokenExpired(
  accessToken: string,
  now = Date.now()
) {
  try {
    const encodedPayload = accessToken.split(".")[1];

    if (!encodedPayload) {
      return true;
    }

    const normalizedPayload = encodedPayload
      .replace(/-/g, "+")
      .replace(/_/g, "/");
    const paddedPayload = normalizedPayload.padEnd(
      Math.ceil(normalizedPayload.length / 4) * 4,
      "="
    );
    const payload = JSON.parse(
      atob(paddedPayload)
    ) as { exp?: unknown };

    return (
      typeof payload.exp !== "number" ||
      payload.exp * 1000 <= now + 60_000
    );
  } catch {
    return true;
  }
}

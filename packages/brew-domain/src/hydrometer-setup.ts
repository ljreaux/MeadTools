/** Cubic iSpindel calibration: a × angle³ + b × angle² + c × angle + d. */
export function parseHydrometerCoefficients(values: readonly string[]): number[] | null {
  if (values.length !== 4) return null;
  const parsed: number[] = [];
  for (const value of values) {
    const text = value.trim().replace(",", ".");
    if (!/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:e[+-]?\d+)?$/i.test(text)) return null;
    const number = Number(text);
    if (!Number.isFinite(number)) return null;
    parsed.push(number);
  }
  return parsed;
}

/** These are configuration text, never navigation URLs: some contain a private token. */
export function hydrometerSetupAddresses(baseUrl: string, token?: string | null) {
  const base = new URL(baseUrl);
  if (
    !["https:", "http:"].includes(base.protocol) ||
    base.username ||
    base.password ||
    base.search ||
    base.hash
  )
    throw new Error("Invalid hydrometer server address");
  const server = base.toString().replace(/\/+$/, "");
  return {
    server,
    iSpindelPath: "/api/ispindel",
    tilt: token ? `${server}/api/hydrometer/tilt?token=${encodeURIComponent(token)}` : null,
    raptCloud: token
      ? `${server}/api/hydrometer/rapt-pill/cloud?token=${encodeURIComponent(token)}`
      : null
  };
}

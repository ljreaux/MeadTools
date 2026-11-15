/** Find keys stripped by a schema while allowing defaults added by parsing. */
export function findUnknownField(
  raw: unknown,
  parsed: unknown,
): string | undefined {
  if (!raw || typeof raw !== "object" || !parsed || typeof parsed !== "object")
    return undefined;

  for (const [key, value] of Object.entries(raw)) {
    if (!Object.hasOwn(parsed, key)) return key;
    const nested = findUnknownField(
      value,
      (parsed as Record<string, unknown>)[key],
    );
    if (nested !== undefined) return `${key}.${nested}`;
  }
}

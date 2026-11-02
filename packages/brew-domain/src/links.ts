/** The application supplies its configured public base URL, never the request host. */
export function brewQrUrl(brewId: string, publicBaseUrl: string): string {
  const id = brewLinkId(brewId);
  const base = new URL(publicBaseUrl);
  if (!["http:", "https:"].includes(base.protocol) || base.username || base.password ||
      base.pathname !== "/" || base.search || base.hash) {
    throw new TypeError("Invalid public base URL");
  }
  return `${base.origin}/brews/${id}`;
}

function brewLinkId(brewId: string): string {
  if (!isBrewLinkId(brewId)) {
    throw new TypeError("Invalid brew ID");
  }
  return brewId;
}

/** Brew IDs are UUID database keys; reject malformed keys before querying. */
export function isBrewLinkId(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
}

/** Public destinations are temporary redirects; private/deleted IDs use owner access. */
export function brewLinkDestination(brewId: string, publicRecipeId: number | null, locale = "en"): string {
  const id = brewLinkId(brewId);
  const prefix = locale === "de" ? "/de" : "";
  return publicRecipeId !== null && Number.isSafeInteger(publicRecipeId) && publicRecipeId > 0
    ? `${prefix}/recipes/${publicRecipeId}/brews/${id}`
    : `${prefix}/account/brews/${id}`;
}

type PublicOriginEnvironment = {
  vercelEnv?: string;
  vercelBranchUrl?: string;
  vercelUrl?: string;
  previewPublicOrigin?: string;
  baseUrl?: string;
  nodeEnv?: string;
};

const VERCEL_HOST = /^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.vercel\.app$/i;

/** Keep OAuth, account links, and setup instructions on one stable host. */
export function resolvePublicOrigin(env: PublicOriginEnvironment): string {
  if (env.vercelEnv === "preview") {
    const customOrigin = env.previewPublicOrigin?.trim();
    if (customOrigin) {
      if (!URL.canParse(customOrigin)) throw new Error("Invalid Preview public origin.");
      const url = new URL(customOrigin);
      if (
        url.protocol !== "https:" || url.username || url.password ||
        url.pathname !== "/" || url.search || url.hash
      ) throw new Error("Invalid Preview public origin.");
      return url.origin;
    }

    const host = env.vercelBranchUrl || env.vercelUrl;
    if (host) {
      if (!VERCEL_HOST.test(host)) throw new Error("Invalid Vercel Preview URL.");
      return `https://${host}`;
    }
  }

  const configured = env.baseUrl?.trim();
  if (!configured || !URL.canParse(configured)) {
    throw new Error("Public base URL is not configured.");
  }
  const url = new URL(configured);
  if (
    url.protocol !== "https:" &&
    !(env.nodeEnv !== "production" && url.protocol === "http:" &&
      ["localhost", "127.0.0.1"].includes(url.hostname))
  ) throw new Error("Public base URL must be HTTPS outside local development.");
  return url.origin;
}

export function publicAppOrigin(): string {
  return resolvePublicOrigin({
    vercelEnv: process.env.VERCEL_ENV,
    vercelBranchUrl: process.env.VERCEL_BRANCH_URL,
    vercelUrl: process.env.VERCEL_URL,
    previewPublicOrigin: process.env.PREVIEW_PUBLIC_ORIGIN,
    baseUrl: process.env.NEXT_PUBLIC_BASE_URL,
    nodeEnv: process.env.NODE_ENV,
  });
}

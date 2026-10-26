import { withSentryConfig } from "@sentry/nextjs/config";
import type { NextConfig } from "next";
import createMDX from "@next/mdx";
import { fileURLToPath } from "node:url";

// Preview builds also use NODE_ENV=production. Only the deployed production
// environment should initialize Sentry or generate/upload its source maps.
const sentryEnabled =
  process.env.VERCEL_ENV === "production" &&
  process.env.NODE_ENV !== "development" && process.env.NODE_ENV !== "test";

const nextConfig: NextConfig = {
  env: {
    // This non-secret, build-time flag is shared by browser and server code.
    NEXT_PUBLIC_SENTRY_ENABLED: String(sentryEnabled),
  },
  // OAuth testing through a tunnel loads dev assets from the public app host.
  allowedDevOrigins:
    process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_BASE_URL
      ? [new URL(process.env.NEXT_PUBLIC_BASE_URL).hostname]
      : undefined,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
  outputFileTracingRoot: fileURLToPath(new URL("../..", import.meta.url)),
  pageExtensions: ["md", "mdx", "ts", "tsx"],
  transpilePackages: [
    "@meadtools/api-contract",
    "@meadtools/brew-domain",
    "@meadtools/credit-accounting",
    "@meadtools/core",
    "@meadtools/i18n",
    "@meadtools/schemas",
    "@meadtools/recipe-workflows",
    "@meadtools/recipe-agent",
    "@meadtools/premium-domain",
    "@meadtools/wiki-knowledge",
  ],
};

const withMDX = createMDX({
  extension: /\.(md|mdx)$/,
  options: {
    remarkPlugins: [
      "remark-gfm",
      "remark-frontmatter",
      ["remark-mdx-frontmatter", { name: "meta" }], // creates `export const meta = {...}`
    ],
    rehypePlugins: [
      "rehype-slugs",
      "rehype-autolink-headings",
      "rehype-highlight",
    ],
  },
});

const appConfig = withMDX(nextConfig);

export default sentryEnabled ? withSentryConfig(appConfig, {
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  org: "larry-reaux",

  project: "meadtools",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Uncomment to route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  // tunnelRoute: "/monitoring",

  webpack: {
    // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
    // See the following for more information:
    // https://docs.sentry.io/product/crons/
    // https://vercel.com/docs/cron-jobs
    automaticVercelMonitors: true,

    // Tree-shaking options for reducing bundle size
    treeshake: {
      // Automatically tree-shake Sentry logger statements to reduce bundle size
      removeDebugLogging: true,
    },
  },
}) : appConfig;

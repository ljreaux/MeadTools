import type { Instrumentation } from "next";

export async function register() {
  if (process.env.NEXT_PUBLIC_SENTRY_ENABLED !== "true") return;
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError: Instrumentation.onRequestError = async (...args) => {
  if (process.env.NEXT_PUBLIC_SENTRY_ENABLED !== "true") return;
  const { captureRequestError } = await import("@sentry/nextjs");
  await captureRequestError(...args);
};

import { i18nRouter } from "next-i18n-router";
import { i18nConfig } from "@meadtools/i18n";
import { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  return i18nRouter(request, i18nConfig);
}

// applies this middleware only to files in the app directory
export const config = {
  matcher: [
    "/oauth/connect/:path*",
    "/((?!api|mcp|oauth|static|.*\\..*|_next).*)",
  ],
};

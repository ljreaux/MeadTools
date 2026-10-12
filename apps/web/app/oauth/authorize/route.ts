import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/lib/userAccessFunctions";
import { isMcpRolloutEnabled } from "@/lib/mcp/access";
import {
  issueAuthorizationCode,
  OAuthRequestError,
  oauthRedirect,
  signConsentRequest,
  validateAuthorizationRequest,
  verifyConsentRequest,
} from "@/lib/mcp/oauth";
import { mcpOrigin } from "@/lib/mcp/metadata";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!isMcpRolloutEnabled()) return new NextResponse(null, { status: 404 });
  if (request.nextUrl.search.length > 4_096) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  if (!request.headers.get("accept")?.includes("application/json")) {
    const localeCookie = request.cookies.get("NEXT_LOCALE")?.value;
    const locale = localeCookie === "de" || localeCookie === "en"
      ? localeCookie : request.headers.get("accept-language")?.toLowerCase().startsWith("de") ? "de" : "en";
    return NextResponse.redirect(new URL(`/${locale}/oauth/connect${request.nextUrl.search}`, mcpOrigin()));
  }
  const userId = await verifyUser(request);
  if (userId instanceof NextResponse || typeof userId !== "number") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const authorization = await validateAuthorizationRequest(request.nextUrl.searchParams, userId);
    const consent = signConsentRequest(authorization);
    return NextResponse.json({
      clientName: authorization.clientName,
      redirectHost: new URL(authorization.redirectUri).hostname,
      redirectUri: authorization.redirectUri,
      signedRequest: consent,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const code = error instanceof OAuthRequestError ? error.code : "server_error";
    return NextResponse.json({ error: code }, { status: code === "server_error" ? 500 : 400 });
  }
}

export async function POST(request: NextRequest) {
  if (!isMcpRolloutEnabled()) return new NextResponse(null, { status: 404 });
  if (request.headers.get("origin") && request.headers.get("origin") !== mcpOrigin()) {
    return new NextResponse(null, { status: 403 });
  }
  const length = Number(request.headers.get("content-length"));
  if (Number.isFinite(length) && length > 4_096) return new NextResponse(null, { status: 413 });
  const body = await request.text();
  if (Buffer.byteLength(body, "utf8") > 4_096) return new NextResponse(null, { status: 413 });
  const form = new URLSearchParams(body);
  const userId = await verifyUser(request);
  if (userId instanceof NextResponse || typeof userId !== "number") {
    return new NextResponse(null, { status: 401 });
  }
  try {
    const signedConsent = form.get("authorization_request") ?? "";
    const authorization = verifyConsentRequest(signedConsent, userId);
    const decision = form.get("decision");
    const jsonResponse = request.headers.get("accept")?.includes("application/json");
    const finish = (url: URL) => jsonResponse
      ? NextResponse.json({ redirectUrl: url.toString() }, { headers: { "Cache-Control": "no-store" } })
      : NextResponse.redirect(url, 302);
    if (decision === "deny") {
      return finish(oauthRedirect(authorization, { error: "access_denied" }));
    }
    if (decision !== "approve") return new NextResponse(null, { status: 400 });
    try {
      const code = await issueAuthorizationCode(authorization, signedConsent);
      return finish(oauthRedirect(authorization, { code }));
    } catch (error) {
      if (error instanceof OAuthRequestError && error.code === "access_denied") {
        return finish(oauthRedirect(authorization, { error: "access_denied" }));
      }
      throw error;
    }
  } catch (error) {
    const code = error instanceof OAuthRequestError ? error.code : "server_error";
    return NextResponse.json({ error: code }, { status: code === "server_error" ? 500 : 400 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import {
  exchangeAuthorizationCode,
  exchangeRefreshToken,
  OAuthRequestError,
} from "@/lib/mcp/oauth";

export const runtime = "nodejs";

function errorResponse(code: string, status = 400) {
  return NextResponse.json({ error: code }, {
    status,
    headers: { "Cache-Control": "no-store", Pragma: "no-cache" },
  });
}

export async function POST(request: NextRequest) {
  const length = Number(request.headers.get("content-length"));
  if (Number.isFinite(length) && length > 4_096) return errorResponse("invalid_request", 413);
  const body = await request.text();
  if (Buffer.byteLength(body, "utf8") > 4_096) return errorResponse("invalid_request", 413);
  const form = new URLSearchParams(body);
  const grant = form.get("grant_type");
  const clientId = form.get("client_id") ?? "";
  const resource = form.get("resource") ?? "";
  if (!clientId || clientId.length > 128) return errorResponse("invalid_client", 401);
  try {
    const tokens = grant === "authorization_code"
      ? await exchangeAuthorizationCode({
          code: form.get("code") ?? "",
          clientId,
          redirectUri: form.get("redirect_uri") ?? "",
          verifier: form.get("code_verifier") ?? "",
          resource,
        })
      : grant === "refresh_token"
        ? await exchangeRefreshToken({
            refreshToken: form.get("refresh_token") ?? "",
            clientId, resource, scope: form.get("scope") ?? undefined,
          })
        : null;
    if (!tokens) return errorResponse("unsupported_grant_type");
    return NextResponse.json(tokens, {
      headers: { "Cache-Control": "no-store", Pragma: "no-cache" },
    });
  } catch (error) {
    if (error instanceof OAuthRequestError) return errorResponse(error.code);
    return errorResponse("server_error", 500);
  }
}

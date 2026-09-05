import {
  createLog,
  registerDevice,
  sendEmailUpdate,
  updateBrewGravity,
  verifyToken,
} from "@/lib/db/iSpindel";
import { NextRequest, NextResponse } from "next/server";

const ROUTE = "/api/hydrometer/rapt-pill";
const REQUEST_ID_HEADER = "x-meadtools-request-id";

function logEvent(
  level: "info" | "warn" | "error",
  event: string,
  details: Record<string, unknown>,
) {
  console[level]("[rapt-pill]", { event, route: ROUTE, ...details });
}

/**
 * RAPT Pill log
 * @description Intended for RAPT Pill devices to post readings to MeadTools. Registers or finds a device by name and writes a hydrometer log using the user's hydrometer token.
 * @body HydrometerIngestRequestBody
 * @response 200:HydrometerLogResponse
 * @responseSet none
 * @add 400:HydrometerAuthErrorResponse
 * @add 404:HydrometerAuthErrorResponse
 * @add 500:HydrometerLogErrorResponse
 * @tag Hydrometer Logging
 * @openapi
 */
export async function POST(req: NextRequest) {
  const startedAt = Date.now();
  const requestId = req.headers.get("x-vercel-id") ?? crypto.randomUUID();
  let stage = "parse_body";

  const respond = (response: NextResponse) => {
    response.headers.set(REQUEST_ID_HEADER, requestId);
    logEvent(response.status >= 400 ? "warn" : "info", "response_sent", {
      requestId,
      stage,
      status: response.status,
      durationMs: Date.now() - startedAt,
    });
    return response;
  };

  logEvent("info", "request_received", {
    requestId,
    method: req.method,
    pathname: req.nextUrl.pathname,
    contentType: req.headers.get("content-type"),
    contentLength: req.headers.get("content-length"),
    userAgent: req.headers.get("user-agent"),
  });

  try {
    const body = await req.json();
    const token = typeof body?.token === "string" ? body.token : null;
    logEvent("info", "body_parsed", {
      requestId,
      payloadKeys:
        body && typeof body === "object" ? Object.keys(body).sort() : [],
      deviceName: typeof body?.name === "string" ? body.name : null,
      hasToken: Boolean(body?.token),
      tokenLength: token?.length ?? null,
      tokenHasSurroundingWhitespace:
        token === null ? null : token !== token.trim(),
    });

    if (!body || !body.token) {
      stage = "validate_token";
      logEvent("warn", "request_rejected", {
        requestId,
        reason: "missing_token",
      });
      return respond(
        NextResponse.json({ error: "Missing token" }, { status: 400 }),
      );
    }

    stage = "verify_token";
    const userId = await verifyToken(body.token);
    if (userId instanceof NextResponse) {
      logEvent("warn", "token_rejected", {
        requestId,
        status: userId.status,
      });
      return respond(userId);
    }
    logEvent("info", "token_verified", { requestId, userId });

    stage = "register_device";
    const newDevice = { userId, device_name: body.name };
    const device = await registerDevice(newDevice);
    const { brew_id } = device;
    logEvent("info", "device_ready", {
      requestId,
      deviceId: device.id,
      brewId: brew_id,
    });

    const gravity = body.gravity;

    stage = "update_brew";
    if (brew_id) await updateBrewGravity(brew_id, gravity);
    logEvent("info", brew_id ? "brew_updated" : "brew_update_skipped", {
      requestId,
      brewId: brew_id,
    });

    stage = "send_email_update";
    await sendEmailUpdate(brew_id);
    logEvent("info", "email_update_completed", { requestId, brewId: brew_id });

    stage = "create_log";
    const data = {
      ...body,
      calculated_gravity: null,
      brew_id,
      device_id: device.id,
    };

    const log = await createLog(data);
    logEvent("info", "log_created", {
      requestId,
      logId: log.id,
      deviceId: device.id,
      brewId: brew_id,
    });

    stage = "complete";
    return respond(NextResponse.json(log, { status: 200 }));
  } catch (error) {
    logEvent("error", "request_failed", {
      requestId,
      stage,
      errorName: error instanceof Error ? error.name : "UnknownError",
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
    });
    return respond(
      NextResponse.json({ error: "Failed to log" }, { status: 500 }),
    );
  }
}

import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";
import ShortUniqueId from "short-unique-id";
import { escapeHtml, sendEmail } from "./emailHelpers";

export type LogType = {
  id?: string;
  brew_id: string | null;
  device_id: string;
  angle?: number;
  temperature: number;
  temp_units?: "C" | "F";
  battery?: number;
  gravity: number;
  interval?: number;
  dateTime?: Date;
  calculated_gravity: number | null;
};

export async function getHydrometerToken(userId: number) {
  try {
    return await prisma.users.findUnique({
      where: { id: userId },
      select: { hydro_token: true }
    });
  } catch (error) {
    console.error("Error fetching recipes for user:", error);
    throw new Error("Failed to fetch recipes.");
  }
}

export async function getDevicesForUser(userId: number) {
  try {
    return await prisma.devices.findMany({
      where: { user_id: userId },
      orderBy: [{ device_name: "asc" }, { id: "asc" }],
      select: {
        id: true,
        device_name: true,
        brew_id: true,
        recipe_id: true,
        coefficients: true,
        // include the *active* brew this device is attached to
        brews: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });
  } catch (error) {
    console.error("Error fetching devices for user:", error);
    throw new Error("Failed to fetch devices.");
  }
}

export async function verifyToken(token: string | undefined) {
  if (!token) {
    return NextResponse.json({ error: "Invalid token" }, { status: 404 });
  }
  try {
    const userId = await prisma.users.findFirst({
      where: {
        hydro_token: token
      },
      select: {
        id: true
      }
    });
    if (!userId) {
      return NextResponse.json({ error: "Invalid token" }, { status: 404 });
    }
    return userId?.id;
  } catch (error) {
    console.error("Error fetching user:", error);
    throw new Error("Failed to find user for device.");
  }
}

export async function registerDevice({
  device_name,
  userId
}: {
  device_name: string;
  userId: number;
}) {
  try {
    const found = await prisma.devices.findFirst({
      where: { device_name, user_id: userId }
    });

    const isRegistered = !!found;
    if (isRegistered) return found;

    return await prisma.devices.create({
      data: { device_name, user_id: userId }
    });
  } catch (error) {
    console.error("Error registering device:", error);
    throw new Error("Failed to register device");
  }
}
export function calcGravity([a, b, c, d]: number[], angle: number) {
  return a * Math.pow(angle, 3) + b * Math.pow(angle, 2) + c * angle + d;
}

export async function updateBrewGravity(brewId: string, gravity: number) {
  try {
    return await prisma.brews.update({
      where: { id: brewId },
      data: { latest_gravity: gravity }
    });
  } catch (error) {
    console.error("Error updating gravity:", error);
    throw new Error("Error updating gravity.");
  }
}

type AlertKind = "fg" | "sb";

function buildEmail({
  kind,
  displayName,
  brewLabel,
  og,
  latest,
  threshold
}: {
  kind: AlertKind;
  displayName: string;
  brewLabel: string;
  og: number;
  latest: number;
  threshold: number;
}) {
  const isFG = kind === "fg";

  const subject = isFG
    ? `Brew Update: ${brewLabel} reached final gravity`
    : `Brew Alert: ${brewLabel} approaching 1/3 sugar break`;

  const text = isFG
    ? `Hello ${displayName},

Your brew "${brewLabel}" is approaching final gravity (FG).

Original Gravity: ${og}
Current Gravity: ${latest}
FG: ${threshold.toFixed(3)}

If fermentation is complete, consider cold-crashing, stabilizing, or packaging.

This is an automated notification from MeadTools.`
    : `Hello ${displayName},

Your brew "${brewLabel}" is approaching the 1/3 sugar break.

Original Gravity: ${og}
Current Gravity: ${latest}
Sugar Break: ${threshold.toFixed(3)}

This is an automated notification from MeadTools.`;

  const thirdRow = isFG
    ? ""
    : `<tr style="background:#fafafa;">
                  <td style="padding:10px 12px;border:1px solid #ddd;">Sugar Break</td>
                  <td align="right" style="padding:10px 12px;border:1px solid #ddd;font-variant-numeric:tabular-nums;">${threshold.toFixed(3)}</td>
                </tr>`;

  const logoUrl = "https://meadtools.com/assets/full-logo.png";
  const brandGold = "#cb9f52";

  const html = `
  <!-- Preheader (hidden preview text) -->
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">
    ${isFG ? "Final gravity reached" : "Approaching 1/3 sugar break"} for ${escapeHtml(brewLabel)}.
  </div>

  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f6f7f9;padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:100%;max-width:600px;background:#ffffff;border:1px solid #e0e0e0;border-radius:10px;overflow:hidden;">
          <!-- Header -->
          <tr>
            <td align="center" style="background:${brandGold};padding:28px 16px;border-top-left-radius:10px;border-top-right-radius:10px;">
              <div style="font:700 24px/1.3 Arial,Helvetica,sans-serif;color:#fff;letter-spacing:0.5px;">
                ${isFG ? "Final Gravity Alert" : "Brew Alert"}
              </div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:22px 22px 8px 22px;font:16px/1.5 Arial,Helvetica,sans-serif;color:#222;">
              <p style="margin:0 0 12px 0;">Hello <strong>${escapeHtml(displayName)}</strong>,</p>
              <p style="margin:0 0 16px 0;">
                ${
                  isFG
                    ? `Your brew <strong>${escapeHtml(brewLabel)}</strong> is approaching final gravity (FG).`
                    : `Your brew <strong>${escapeHtml(brewLabel)}</strong> is approaching the 1/3 sugar break.`
                }
              </p>
            </td>
          </tr>

          <!-- Metrics Table -->
          <tr>
            <td style="padding:0 22px 6px 22px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border:1px solid #ddd;border-collapse:collapse;font:15px/1.45 Arial,Helvetica,sans-serif;">
                <tr style="background:#fafafa;">
                  <td style="padding:10px 12px;border:1px solid #ddd;">Original Gravity</td>
                  <td align="right" style="padding:10px 12px;border:1px solid #ddd;font-variant-numeric:tabular-nums;">${og.toFixed(3)}</td>
                </tr>
                <tr>
                  <td style="padding:10px 12px;border:1px solid #ddd;">Current Gravity</td>
                  <td align="right" style="padding:10px 12px;border:1px solid #ddd;font-variant-numeric:tabular-nums;">${latest.toFixed(3)}</td>
                </tr>
                ${thirdRow}
              </table>
            </td>
          </tr>

          <!-- Footer -->
            <tr>
              <td style="padding:18px 22px 22px 22px;font:13px/1.5 Arial,Helvetica,sans-serif;color:#6b7280;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <!-- Left column: text + links -->
                    <td align="left" style="font:13px/1.5 Arial,Helvetica,sans-serif;color:#6b7280;">
                      <div style="margin-bottom:6px;">This is an automated notification from MeadTools.</div>
                      <a href="https://meadtools.com/account/hydrometer/brews" 
                        style="color:#222;text-decoration:underline;">Manage brews</a> ·
                      <a href="https://meadtools.com" 
                        style="color:#222;text-decoration:underline;">Open MeadTools</a>
                    </td>

                    <!-- Right column: logo -->
                    <td align="right" valign="middle">
                      <img src="${logoUrl}" alt="MeadTools" width="120" 
                          style="display:block;width:120px;height:auto;margin-left:auto;">
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
        </table>
      </td>
    </tr>
  </table>
`;
  return { subject, text, html };
}

export async function sendEmailUpdate(brewId: string | null) {
  if (!brewId) return;
  try {
    const brew = await prisma.brews.findUnique({
      where: { id: brewId },
      select: {
        id: true,
        name: true,
        latest_gravity: true,
        requested_email_alerts: true,
        sb_alert_sent: true,
        fg_alert_sent: true,
        users: { select: { email: true, public_username: true } },
        logs: {
          orderBy: { datetime: "asc" },
          take: 1,
          select: { calculated_gravity: true, gravity: true }
        }
      }
    });
    if (!brew) return;

    const oldestLog = brew.logs[0];
    const latest = brew.latest_gravity;
    if (!oldestLog || latest == null) return;

    const og = oldestLog.calculated_gravity ?? oldestLog.gravity;
    if (og == null) return;

    const offset = 1.005;
    const sugarBreak = (2 * (og - 1)) / 3 + offset;

    const atOrBelowFG = latest <= offset;
    const atOrBelowSB = latest <= sugarBreak;

    const to = brew.users?.email;
    if (!to || !brew.requested_email_alerts) return;

    const displayName =
      brew.users?.public_username?.trim() || brew.users?.email || "there";
    const brewLabel = brew.name ?? "Unnamed Brew";

    // Final gravity alert
    if (!brew.fg_alert_sent && atOrBelowFG) {
      const { subject, text, html } = buildEmail({
        kind: "fg",
        displayName,
        brewLabel,
        og,
        latest,
        threshold: offset
      });
      await sendEmail({ to, subject, text, html });
      await prisma.brews.update({
        where: { id: brew.id },
        data: { fg_alert_sent: true }
      });
      return;
    }

    // Sugar break alert
    if (!brew.sb_alert_sent && atOrBelowSB) {
      const { subject, text, html } = buildEmail({
        kind: "sb",
        displayName,
        brewLabel,
        og,
        latest,
        threshold: sugarBreak
      });
      await sendEmail({ to, subject, text, html });
      await prisma.brews.update({
        where: { id: brew.id },
        data: { sb_alert_sent: true }
      });
    }
  } catch (error) {
    console.error("Error sending email update:", error);
  }
}

export async function createLog(log: LogType) {
  const data = {
    brew_id: log.brew_id,
    device_id: log.device_id,
    angle: log.angle || 0,
    temperature: log.temperature,
    temp_units: log.temp_units || "F",
    battery: log.battery || 0,
    gravity: log.gravity,
    interval: log.interval || 0,
    calculated_gravity: log.calculated_gravity
  };

  try {
    return await prisma.logs.create({
      data
    });
  } catch (error) {
    console.error("Error creating log:", error);
    throw new Error("Error creating log.");
  }
}

export async function getLogs(
  deviceId: string,
  beginDate: Date,
  endDate: Date
) {
  try {
    return await prisma.logs.findMany({
      where: {
        device_id: deviceId,
        datetime: {
          gte: beginDate,
          lte: endDate
        }
      }
    });
  } catch (error) {
    console.error("Error fetching logs:", error);
    throw new Error("Error fetching logs.");
  }
}

export async function getLogsForBrew(brew_id: string, userId?: number) {
  try {
    // Fetch the brew and logs in one query
    const brewWithLogs = await prisma.brews.findUnique({
      where: { id: brew_id },
      include: {
        logs: {
          orderBy: { datetime: "asc" }
        }
      }
    });

    if (!brewWithLogs) {
      throw new Error("Brew not found");
    }

    if (brewWithLogs.user_id !== userId) {
      throw new Error("You are not authorized to view these logs");
    }

    return brewWithLogs.logs;
  } catch (error) {
    console.error("Error fetching logs for brew:", error);
    throw new Error("Error fetching logs for brew.");
  }
}

export async function updateLog(
  id: string,
  _deviceId: string,
  raw: Partial<LogType>
) {
  // Build a clean `data` object for Prisma
  const data: any = {};

  // Numeric fields that might come in as strings
  const numericFields: (keyof LogType)[] = [
    "angle",
    "temperature",
    "battery",
    "gravity",
    "interval",
    "calculated_gravity"
  ];

  for (const [key, value] of Object.entries(raw)) {
    if (value === undefined || value === null || value === "") continue;

    // Coerce numeric stuff
    if (numericFields.includes(key as keyof LogType)) {
      const num =
        typeof value === "number"
          ? value
          : Number((value as string).replace(",", "."));

      if (!Number.isFinite(num)) {
        // Skip invalid numeric values instead of corrupting data
        continue;
      }

      data[key] = num;
      continue;
    }

    // Map TS `dateTime` -> DB `datetime`
    if (key === "dateTime") {
      const d = new Date(value as any);
      if (!Number.isNaN(d.getTime())) {
        data.datetime = d;
      }
      continue;
    }

    if (key === "temp_units") {
      if (value === "C" || value === "F") {
        data.temp_units = value;
      }
      continue;
    }

    // Never let these be updated by this endpoint
    if (key === "id" || key === "device_id" || key === "brew_id") {
      continue;
    }

    // Any other safe scalar fields could be passed through here if you add them
    data[key] = value;
  }

  if (Object.keys(data).length === 0) {
    throw new Error("No valid fields to update");
  }

  try {
    return await prisma.logs.update({
      where: { id },
      data
    });
  } catch (error) {
    console.error("Error updating log:", error);
    throw new Error("Error updating log.");
  }
}

export async function deleteLog(logId: string, device_id: string) {
  try {
    return await prisma.logs.delete({
      where: { id: logId, device_id }
    });
  } catch (error) {
    console.error(error);
    throw new Error("Error deleting log.");
  }
}

export async function deleteLogsInRange(
  device_id: string,
  startDate: Date,
  endDate: Date
) {
  try {
    const logsToDelete = await prisma.logs.findMany({
      where: {
        device_id,
        datetime: { gte: startDate, lte: endDate }
      }
    });

    if (logsToDelete.length === 0) {
      throw new Error("No logs found to delete.");
    }

    const logIdsToDelete = logsToDelete.map((log: { id: string }) => log.id);

    return await prisma.logs.deleteMany({
      where: { id: { in: logIdsToDelete } }
    });
  } catch (error) {
    console.error("Error deleting logs in range:", error);
    throw new Error("Error deleting logs.");
  }
}

export async function createHydrometerToken(userId: number) {
  const { randomUUID } = new ShortUniqueId();
  const token = randomUUID(10);
  try {
    await prisma.users.update({
      where: { id: userId },
      data: { hydro_token: token }
    });
    return { token };
  } catch (err) {
    console.error("Error creating hydrometer token:", err);
    throw new Error("Failed to create hydrometer token.");
  }
}

export async function getBrews(user_id: number) {
  try {
    return await prisma.brews.findMany({
      where: { user_id },
      orderBy: [
        // 1. Active brews (end_date = null) first, then most recently finished
        { end_date: "desc" },

        // 2. Within same end_date bucket, oldest started first
        { start_date: "asc" }
      ]
    });
  } catch (error) {
    console.error("Error fetching brews:", error);
    throw new Error("Error fetching brews.");
  }
}

export async function startBrew(
  device_id: string,
  user_id: number,
  brew_name: string
) {
  try {
    const currentDevice = await prisma.devices.findFirst({
      where: { id: device_id }
    });
    const hasActiveBrew = typeof currentDevice?.brew_id === "string";

    if (hasActiveBrew) {
      throw new Error("A brew is already in progress.");
    }

    const brew = await prisma.brews.create({
      data: {
        user_id,
        name: brew_name,
        start_date: new Date()
      }
    });

    const device = await prisma.devices.update({
      where: { id: device_id },
      data: { brew_id: brew.id }
    });

    return [brew, device];
  } catch (error) {
    console.error(error);
    throw error;
  }
}

export async function endBrew(id: string, brew_id: string, user_id: number) {
  try {
    const brew = await prisma.brews.update({
      where: { user_id, id: brew_id },
      data: { end_date: new Date() }
    });

    const device = await prisma.devices.update({
      where: { id },
      data: { brew_id: null }
    });

    return [brew, device];
  } catch (error) {
    console.error(error);
    throw new Error("Error ending brew.");
  }
}

export async function setBrewName(id: string, name: string, user_id: number) {
  try {
    return await prisma.brews.update({
      where: { user_id, id },
      data: { name }
    });
  } catch (error) {
    console.error(error);
    throw new Error("Error setting brew name.");
  }
}

export async function addRecipeToBrew(
  recipe_id: number,
  id: string,
  user_id: number
) {
  try {
    return await prisma.brews.update({
      where: { user_id, id },
      data: { recipe_id }
    });
  } catch (error) {
    console.error(error);
    throw new Error("Error adding recipe to brew.");
  }
}

export async function receiveBrewAlerts(
  brew_id: string,
  requested_email_alerts: boolean
) {
  try {
    return await prisma.brews.update({
      where: { id: brew_id },
      data: { requested_email_alerts }
    });
  } catch (error) {
    console.error(error);
    throw new Error("Error allowing email updates.");
  }
}

export async function deleteBrew(brew_id: string, user_id: number) {
  try {
    // Check if a device is associated with the brew and the user
    const device = await prisma.devices.findFirst({
      where: {
        user_id,
        brew_id
      }
    });

    if (device) {
      // Detach the device from the brew
      await prisma.devices.update({
        where: { id: device.id, user_id },
        data: { brew_id: null }
      });

      // Delete logs associated with this brew and device
      await prisma.logs.deleteMany({
        where: {
          brew_id,
          device_id: device.id
        }
      });
    } else {
      // Delete logs associated with this brew only
      await prisma.logs.deleteMany({
        where: { brew_id }
      });
    }

    // Delete the brew
    const deleted_brew = await prisma.brews.delete({
      where: { id: brew_id, user_id }
    });

    if (!deleted_brew) {
      throw new Error("Brew not found.");
    }

    return {
      message: `Your brew "${
        deleted_brew.name || deleted_brew.id
      }" has been successfully deleted along with all of its logs.`
    };
  } catch (error) {
    console.error("Error deleting brew:", error);
    throw new Error("Failed to delete brew.");
  }
}

export async function updateCoefficients(
  user_id: number,
  id: string,
  coefficients?: number[]
) {
  try {
    if (!coefficients) throw new Error("No coefficients provided");

    return await prisma.devices.update({
      where: { id, user_id },
      data: { coefficients }
    });
  } catch (error) {
    console.error("Error updating coefficients:", error);
    throw new Error("Error updating coefficients.");
  }
}

export async function deleteDevice(device_id: string, user_id: number) {
  try {
    // Delete logs associated with the device where the brew_id is null
    await prisma.logs.deleteMany({
      where: {
        device_id,
        brew_id: null
      }
    });

    // Set device_id to null for logs associated with the device
    await prisma.logs.updateMany({
      where: { device_id },
      data: { device_id: null }
    });

    // Delete the device belonging to the user
    await prisma.devices.deleteMany({
      where: {
        id: device_id,
        user_id
      }
    });

    return { message: `Device ${device_id} deleted successfully.` };
  } catch (error) {
    console.error("Error deleting device:", error);
    throw new Error("Failed to delete device.");
  }
}

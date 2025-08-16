import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";
import ShortUniqueId from "short-unique-id";
import nodemailer from "nodemailer";

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
      select: { hydro_token: true },
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
        hydro_token: token,
      },
      select: {
        id: true,
      },
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
  userId,
}: {
  device_name: string;
  userId: number;
}) {
  try {
    const found = await prisma.devices.findFirst({
      where: { device_name, user_id: userId },
    });

    const isRegistered = !!found;
    if (isRegistered) return found;

    return await prisma.devices.create({
      data: { device_name, user_id: userId },
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
      data: { latest_gravity: gravity },
    });
  } catch (error) {
    console.error("Error updating gravity:", error);
    throw new Error("Error updating gravity.");
  }
}

const escapeHtml = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export async function sendEmailUpdate(brewId: string | null) {
  try {
    if (!brewId) return;

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
          select: { calculated_gravity: true, gravity: true },
        },
      },
    });
    if (!brew) return;

    const oldestLog = brew.logs[0];
    const latest = brew.latest_gravity;
    if (!oldestLog || latest == null) return;

    const og = oldestLog.calculated_gravity ?? oldestLog.gravity;
    if (og == null) return;

    const offset = 1.005; // FG threshold
    const sugarBreak = (2 * (og - 1)) / 3 + offset; // your current SB math w/ offset
    const atOrBelowSB = latest <= sugarBreak;
    const atOrBelowFG = latest <= offset;

    const to = brew.users?.email;
    if (!to || !brew.requested_email_alerts) return;

    const displayName =
      brew.users?.public_username?.trim() || brew.users?.email || "there";
    const brewLabel = brew.name ?? "Unnamed Brew";

    if (!brew.fg_alert_sent && atOrBelowFG && brew.requested_email_alerts) {
      const subject = `Brew Update: ${brewLabel} reached final gravity`;
      const text = `Hello ${displayName},

Your brew "${brewLabel}" is approaching final gravity (FG).

Original Gravity: ${og}
Current Gravity: ${latest}
FG Threshold (offset): ${offset.toFixed(3)}

If fermentation is complete, consider cold-crashing, stabilizing, or packaging as desired.

This is an automated notification from MeadTools.`;

      const html = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;border:1px solid #e0e0e0;border-radius:8px;overflow:hidden;">
          <div style="background-color:#cb9f52;color:white;padding:16px;font-size:20px;font-weight:bold;">
            MeadTools Final Gravity Alert
          </div>
          <div style="padding:20px;">
            <p style="font-size:16px;">Hello ${escapeHtml(displayName)},</p>
            <p style="font-size:16px;">
              Your brew <strong>${escapeHtml(brewLabel)}</strong> appears to have reached final gravity (FG).
            </p>
            <table style="width:100%;border-collapse:collapse;margin-top:12px;">
              <tr><td style="padding:8px;border:1px solid #ccc;">Original Gravity</td><td style="padding:8px;border:1px solid #ccc;">${Number(og).toFixed(3)}</td></tr>
              <tr><td style="padding:8px;border:1px solid #ccc;">Current Gravity</td><td style="padding:8px;border:1px solid #ccc;">${Number(latest).toFixed(3)}</td></tr>
            </table>
             <p style="margin-top:20px;font-size:14px;color:#555;">
              This is an automated notification from MeadTools.
            </p>
          </div>
        </div>
      `;

      await sendEmail({ to, subject, text, html });

      await prisma.brews.update({
        where: { id: brew.id },
        data: { fg_alert_sent: true },
      });

      return; // don't also send the sugar-break email on the same run
    }

    if (!brew.sb_alert_sent && atOrBelowSB && brew.requested_email_alerts) {
      const subject = `Brew Alert: ${brewLabel} approaching 1/3 sugar break`;
      const text = `Hello ${displayName},

Your brew "${brewLabel}" is approaching the 1/3 sugar break.

Original Gravity: ${og}
Current Gravity: ${latest}
Sugar Break Threshold: ${sugarBreak.toFixed(3)}

This is an automated notification from MeadTools.`;

      const html = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;border:1px solid #e0e0e0;border-radius:8px;overflow:hidden;">
          <div style="background-color:#cb9f52;color:white;padding:16px;font-size:20px;font-weight:bold;">
            MeadTools Brew Alert
          </div>
          <div style="padding:20px;">
            <p style="font-size:16px;">Hello ${escapeHtml(displayName)},</p>
            <p style="font-size:16px;">
              Your brew <strong>${escapeHtml(brewLabel)}</strong> is approaching the 1/3 sugar break.
            </p>
            <table style="width:100%;border-collapse:collapse;margin-top:12px;">
              <tr><td style="padding:8px;border:1px solid #ccc;">Original Gravity</td><td style="padding:8px;border:1px solid #ccc;">${Number(og).toFixed(3)}</td></tr>
              <tr><td style="padding:8px;border:1px solid #ccc;">Current Gravity</td><td style="padding:8px;border:1px solid #ccc;">${Number(latest).toFixed(3)}</td></tr>
              <tr><td style="padding:8px;border:1px solid #ccc;">Sugar Break</td><td style="padding:8px;border:1px solid #ccc;">${Number(sugarBreak).toFixed(3)}</td></tr>
            </table>
            <p style="margin-top:20px;font-size:14px;color:#555;">
              This is an automated notification from MeadTools.
            </p>
          </div>
        </div>
      `;

      await sendEmail({ to, subject, text, html });

      await prisma.brews.update({
        where: { id: brew.id },
        data: { sb_alert_sent: true },
      });
    }
  } catch (error) {
    console.error("Error sending email update:", error);
  }
}

// Dumb transport: reusable for both emails
export async function sendEmail({
  to,
  subject,
  text,
  html,
}: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}) {
  const user = process.env.EMAIL_USER!;
  const pass = process.env.EMAIL_PASS!;

  const transporter = nodemailer.createTransport({
    host: "smtp.office365.com",
    port: 587,
    secure: false,
    requireTLS: true,
    auth: { user, pass },
  });

  await transporter.sendMail({
    from: { name: "MeadTools Alerts", address: user },
    to,
    subject,
    text,
    html,
  });
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
    calculated_gravity: log.calculated_gravity,
  };

  try {
    return await prisma.logs.create({
      data,
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
          lte: endDate,
        },
      },
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
          orderBy: { datetime: "asc" },
        },
      },
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
  deviceId: string,
  data: Partial<LogType>
) {
  try {
    return await prisma.logs.update({
      where: { id },
      data,
    });
  } catch (error) {
    console.error("Error updating log:", error);
    throw new Error("Error updating log.");
  }
}

export async function deleteLog(logId: string, device_id: string) {
  try {
    return await prisma.logs.delete({
      where: { id: logId, device_id },
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
        datetime: { gte: startDate, lte: endDate },
      },
    });

    if (logsToDelete.length === 0) {
      throw new Error("No logs found to delete.");
    }

    const logIdsToDelete = logsToDelete.map((log: { id: string }) => log.id);

    return await prisma.logs.deleteMany({
      where: { id: { in: logIdsToDelete } },
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
      data: { hydro_token: token },
    });
    return { token };
  } catch (err) {
    console.error("Error creating hydrometer token:", err);
    throw new Error("Failed to create hydrometer token.");
  }
}

export async function getBrews(user_id: number) {
  try {
    const brews = await prisma.brews.findMany({
      where: { user_id },
    });

    return brews.sort((a, b) => {
      const endDateA = a.end_date || new Date();
      const endDateB = b.end_date || new Date();

      if (endDateA < endDateB) return 1;
      if (endDateA > endDateB) return -1;

      // If end dates are the same, sort by start date
      return a.start_date < b.start_date ? -1 : 1;
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
      where: { id: device_id },
    });
    const hasActiveBrew = typeof currentDevice?.brew_id === "string";

    if (hasActiveBrew) {
      throw new Error("A brew is already in progress.");
    }

    const brew = await prisma.brews.create({
      data: {
        user_id,
        name: brew_name,
        start_date: new Date(),
      },
    });

    const device = await prisma.devices.update({
      where: { id: device_id },
      data: { brew_id: brew.id },
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
      data: { end_date: new Date() },
    });

    const device = await prisma.devices.update({
      where: { id },
      data: { brew_id: null },
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
      data: { name },
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
      data: { recipe_id },
    });
  } catch (error) {
    console.error(error);
    throw new Error("Error adding recipe to brew.");
  }
}

export async function deleteBrew(brew_id: string, user_id: number) {
  try {
    // Check if a device is associated with the brew and the user
    const device = await prisma.devices.findFirst({
      where: {
        user_id,
        brew_id,
      },
    });

    if (device) {
      // Detach the device from the brew
      await prisma.devices.update({
        where: { id: device.id, user_id },
        data: { brew_id: null },
      });

      // Delete logs associated with this brew and device
      await prisma.logs.deleteMany({
        where: {
          brew_id,
          device_id: device.id,
        },
      });
    } else {
      // Delete logs associated with this brew only
      await prisma.logs.deleteMany({
        where: { brew_id },
      });
    }

    // Delete the brew
    const deleted_brew = await prisma.brews.delete({
      where: { id: brew_id, user_id },
    });

    if (!deleted_brew) {
      throw new Error("Brew not found.");
    }

    return {
      message: `Your brew "${
        deleted_brew.name || deleted_brew.id
      }" has been successfully deleted along with all of its logs.`,
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
      data: { coefficients },
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
        brew_id: null,
      },
    });

    // Set device_id to null for logs associated with the device
    await prisma.logs.updateMany({
      where: { device_id },
      data: { device_id: null },
    });

    // Delete the device belonging to the user
    await prisma.devices.deleteMany({
      where: {
        id: device_id,
        user_id,
      },
    });

    return { message: `Device ${device_id} deleted successfully.` };
  } catch (error) {
    console.error("Error deleting device:", error);
    throw new Error("Failed to delete device.");
  }
}

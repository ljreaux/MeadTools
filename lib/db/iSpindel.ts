import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";
import ShortUniqueId from "short-unique-id";

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

import prisma from "@/lib/prisma";
import {
  Prisma,
  brew_stage,
  brew_entry_type,
  temp_units
} from "@prisma/client";

export type BrewListItem = {
  id: string;
  name: string | null;
  start_date: Date;
  end_date: Date | null;

  stage: brew_stage;
  current_volume_liters: number | null;

  recipe_id: number | null;
  recipe_name: string | null;

  entry_count: number;
  latest_gravity: number | null;
};

export type BrewEntryForApp = {
  id: string;
  datetime: Date;
  type: brew_entry_type;
  title: string | null;
  note: string | null;

  gravity: number | null;
  temperature: number | null;
  temp_units: temp_units | null;

  data: Prisma.JsonValue | null;
  user_id: number | null;
};

export type EntriesByStage = Array<{
  stage: brew_stage;
  entries: BrewEntryForApp[];
}>;

export type BrewForApp = {
  id: string;
  name: string | null;
  start_date: Date;
  end_date: Date | null;

  stage: brew_stage;
  batch_number: number | null;
  current_volume_liters: number | null;

  latest_gravity: number | null;

  recipe_id: number | null;
  recipe_name: string | null;

  recipe_snapshot: Prisma.JsonValue | null;
  entry_count: number;

  entries: BrewEntryForApp[];
  entries_by_stage: EntriesByStage;
};

export type PatchBrewMetadataInput = {
  name?: string | null;
  stage?: brew_stage;
  current_volume_liters?: number | null;
  requested_email_alerts?: boolean;
  end_date?: string | Date | null; // allow ISO string from client
};

export type CreateBrewEntryInput = {
  type: brew_entry_type;

  datetime?: string | Date;
  title?: string | null;
  note?: string | null;

  gravity?: number | null;
  temperature?: number | null;
  temp_units?: temp_units | null;

  data?: Prisma.JsonValue | null;

  // for stage change only (preferred explicit field; fallback to data.to if you want)
  stage_to?: brew_stage;
};

export type PatchBrewEntryInput = {
  datetime?: string | Date;
  title?: string | null;
  note?: string | null;

  gravity?: number | null;
  temperature?: number | null;
  temp_units?: temp_units | null;

  data?: Prisma.JsonValue | null;
};

export async function getBrewsForApp(userId: number): Promise<BrewListItem[]> {
  const rows = await prisma.brews.findMany({
    where: { user_id: userId },
    orderBy: [
      { end_date: "desc" }, // active brews first (nulls sort first with desc in PG)
      { start_date: "asc" }
    ],
    select: {
      id: true,
      name: true,
      start_date: true,
      end_date: true,
      stage: true,
      current_volume_liters: true,
      latest_gravity: true,
      recipe_id: true,
      recipes: { select: { name: true } },
      _count: { select: { entries: true } }
    }
  });

  return rows.map((b) => ({
    id: b.id,
    name: b.name,
    start_date: b.start_date,
    end_date: b.end_date,

    stage: b.stage,
    current_volume_liters: b.current_volume_liters,

    recipe_id: b.recipe_id,
    recipe_name: b.recipes?.name ?? null,

    entry_count: b._count.entries,
    latest_gravity: b.latest_gravity
  }));
}

export type CreateBrewInput = {
  recipe_id: number;
  name?: string | null;
  current_volume_liters?: number | null;
};

export type AttachDeviceInput = {
  device_id: string;
  /** if true, allow moving a device already attached to another brew */
  force?: boolean;
};

export type AdoptLogsInput = {
  device_id: string;

  /** Optional: only move logs within a datetime range */
  start_date?: string | Date;
  end_date?: string | Date;

  /**
   * By default we only adopt logs where brew_id is NULL (safe).
   * If you want to move logs off another brew, pass from_brew_id explicitly.
   */
  from_brew_id?: string | null;
};

export async function createBrewForApp(userId: number, input: CreateBrewInput) {
  const recipeId = Number(input.recipe_id);
  if (!Number.isFinite(recipeId)) throw new Error("Invalid recipe_id");

  const name =
    typeof input.name === "string" && input.name.trim()
      ? input.name.trim()
      : null;

  const currentVolume =
    input.current_volume_liters === null ||
    input.current_volume_liters === undefined
      ? null
      : Number(input.current_volume_liters);

  if (currentVolume !== null && !Number.isFinite(currentVolume)) {
    throw new Error("Invalid current_volume_liters");
  }

  return prisma.$transaction(async (tx) => {
    // 1) Ownership + lock the recipe row to prevent batch_number races
    const lockedRecipeRows = await tx.$queryRaw<Array<{ id: number }>>(
      Prisma.sql`
        SELECT id
        FROM recipes
        WHERE id = ${recipeId} AND user_id = ${userId}
        FOR UPDATE
      `
    );

    if (lockedRecipeRows.length === 0) {
      throw new Error("Recipe not found");
    }

    // 2) Pull recipe data for snapshot (no legacy fields)
    const recipe = await tx.recipes.findFirst({
      where: { id: recipeId, user_id: userId },
      select: {
        id: true,
        name: true,
        version: true,
        dataV2: true
      }
    });

    if (!recipe) throw new Error("Recipe not found");

    // 3) Compute next batch number (per recipe, scoped to this user)
    const max = await tx.brews.aggregate({
      where: { recipe_id: recipeId, user_id: userId },
      _max: { batch_number: true }
    });

    const nextBatchNumber = (max._max.batch_number ?? 0) + 1;

    // 4) Snapshot only what you need
    const recipe_snapshot: Prisma.JsonObject = {
      id: recipe.id,
      name: recipe.name,
      version: recipe.version,
      dataV2: recipe.dataV2 as any,
      snapshottedAt: new Date().toISOString()
    };

    // 5) Create brew
    return tx.brews.create({
      data: {
        user_id: userId,
        recipe_id: recipeId,
        name: name ?? recipe.name,
        stage: brew_stage.PLANNED,
        batch_number: nextBatchNumber,
        current_volume_liters: currentVolume,
        recipe_snapshot
      },
      select: {
        id: true,
        name: true,
        start_date: true,
        end_date: true,
        stage: true,
        batch_number: true,
        current_volume_liters: true,
        recipe_id: true
      }
    });
  });
}

export async function getBrewForApp(
  userId: number,
  brewId: string
): Promise<BrewForApp> {
  const brew = await prisma.brews.findFirst({
    where: { id: brewId, user_id: userId },
    select: {
      id: true,
      name: true,
      start_date: true,
      end_date: true,

      stage: true,
      batch_number: true,
      current_volume_liters: true,
      latest_gravity: true,

      recipe_id: true,
      recipe_snapshot: true,

      recipes: { select: { name: true } },

      entries: {
        orderBy: { datetime: "asc" },
        select: {
          id: true,
          datetime: true,
          type: true,
          title: true,
          note: true,
          gravity: true,
          temperature: true,
          temp_units: true,
          data: true,
          user_id: true
        }
      },

      _count: { select: { entries: true } }
    }
  });

  if (!brew) throw new Error("Brew not found");
  const entries: BrewEntryForApp[] = brew.entries.map((e) => ({
    id: e.id,
    datetime: e.datetime,
    type: e.type,
    title: e.title ?? null,
    note: e.note ?? null,
    gravity: e.gravity ?? null,
    temperature: e.temperature ?? null,
    temp_units: e.temp_units ?? null,
    data: (e.data as Prisma.JsonValue) ?? null,
    user_id: e.user_id ?? null
  }));

  const entries_by_stage = groupEntriesByStage(
    brew.stage ?? brew_stage.PLANNED,
    entries
  );
  return {
    id: brew.id,
    name: brew.name,
    start_date: brew.start_date,
    end_date: brew.end_date,

    stage: brew.stage,
    batch_number: brew.batch_number,
    current_volume_liters: brew.current_volume_liters,

    latest_gravity: brew.latest_gravity,

    recipe_id: brew.recipe_id,
    recipe_name: brew.recipes?.name ?? null,

    recipe_snapshot: (brew.recipe_snapshot as Prisma.JsonValue) ?? null,
    entry_count: brew._count.entries,

    entries,
    entries_by_stage
  };
}

export async function patchBrewMetadata(
  userId: number,
  brewId: string,
  input: PatchBrewMetadataInput
) {
  return prisma.$transaction(async (tx) => {
    // 0) Get current brew (ownership check + “from stage” baseline)
    const existing = await tx.brews.findFirst({
      where: { id: brewId, user_id: userId },
      select: {
        id: true,
        stage: true,
        end_date: true
      }
    });

    if (!existing) throw new Error("Brew not found");

    const fromStage = existing.stage;

    // 1) Build update payload
    const data: Record<string, any> = {};
    let endDateWasSet = false;
    let endDateWasCleared = false;

    // name
    if ("name" in input) {
      const v = input.name;
      data.name =
        typeof v === "string" ? (v.trim() ? v.trim() : null) : v ?? null;
    }

    // stage
    if ("stage" in input) {
      if (!input.stage) throw new Error("Invalid stage");
      data.stage = input.stage;
    }

    // current_volume_liters
    if ("current_volume_liters" in input) {
      const v = input.current_volume_liters;
      if (v === null) data.current_volume_liters = null;
      else {
        const n = Number(v);
        if (!Number.isFinite(n))
          throw new Error("Invalid current_volume_liters");
        data.current_volume_liters = n;
      }
    }

    // requested_email_alerts (allowed for now)
    if ("requested_email_alerts" in input) {
      data.requested_email_alerts = Boolean(input.requested_email_alerts);
    }

    // end_date (null to reopen)
    if ("end_date" in input) {
      const v = input.end_date;

      if (v === null) {
        data.end_date = null;
        endDateWasCleared = true;
      } else {
        const d = v instanceof Date ? v : new Date(v as any);
        if (Number.isNaN(d.getTime())) throw new Error("Invalid end_date");
        data.end_date = d;
        endDateWasSet = true;
      }
    }

    // 2) Apply your “stage/end_date” rules to the FINAL payload

    // Rule A: If ending the brew, force COMPLETE
    if (endDateWasSet) {
      data.stage = brew_stage.COMPLETE;
    }

    // Rule B: If stage is COMPLETE, ensure end_date exists (unless explicitly cleared)
    const finalStageCandidate: brew_stage = (
      "stage" in data ? data.stage : fromStage
    ) as brew_stage;

    const stageIsComplete = finalStageCandidate === brew_stage.COMPLETE;

    if (stageIsComplete && !endDateWasSet && !endDateWasCleared) {
      data.end_date = existing.end_date ?? new Date();
      // ^ keep existing end_date if already set, otherwise set now
    }

    if (Object.keys(data).length === 0) {
      throw new Error("No valid fields to update");
    }

    // 3) Persist metadata (ownership enforced)
    const updated = await tx.brews.updateMany({
      where: { id: brewId, user_id: userId },
      data
    });

    if (updated.count === 0) throw new Error("Brew not found");

    // 4) If stage actually changed, write a STAGE_CHANGE entry (this becomes the pattern)
    const toStage: brew_stage = (
      "stage" in data ? data.stage : fromStage
    ) as brew_stage;

    if (toStage !== fromStage) {
      await tx.brew_entries.create({
        data: {
          brew_id: brewId,
          user_id: userId,
          type: brew_entry_type.STAGE_CHANGE,
          datetime: new Date(),
          title: "Stage change",
          note: null,
          data: {
            from: fromStage,
            to: toStage,
            source: "metadata_patch"
          }
        }
      });
    }

    // 5) Return the updated metadata (same style you’ve been using)
    return tx.brews.findFirst({
      where: { id: brewId, user_id: userId },
      select: {
        id: true,
        name: true,
        start_date: true,
        end_date: true,
        stage: true,
        batch_number: true,
        current_volume_liters: true,
        requested_email_alerts: true,
        latest_gravity: true,
        recipe_id: true
      }
    });
  });
}

export async function deleteBrewForApp(brewId: string, userId: number) {
  // Optional: verify it exists + ownership first (gives nicer “not found”)
  const brew = await prisma.brews.findFirst({
    where: { id: brewId, user_id: userId },
    select: { id: true }
  });

  if (!brew) throw new Error("Brew not found");

  // One transaction so you don’t end up half-deleted
  await prisma.$transaction(async (tx) => {
    // detach ALL devices for this brew owned by this user
    await tx.devices.updateMany({
      where: { user_id: userId, brew_id: brewId },
      data: { brew_id: null }
    });

    // keep existing behavior: delete all logs for this brew
    await tx.logs.deleteMany({
      where: { brew_id: brewId }
    });

    // delete brew (ownership enforced)
    const res = await tx.brews.deleteMany({
      where: { id: brewId, user_id: userId }
    });

    if (res.count === 0) throw new Error("Brew not found");
  });

  return { message: "Brew deleted successfully." };
}

function isBrewStage(v: any): v is brew_stage {
  return (
    typeof v === "string" && Object.values(brew_stage).includes(v as brew_stage)
  );
}

/**
 * Groups entries into “stage buckets” based on STAGE_CHANGE entries.
 * We start from `initialStage`, assign each entry to the current stage,
 * then if the entry is a STAGE_CHANGE with data.to, we advance.
 */
function groupEntriesByStage(
  initialStage: brew_stage,
  entries: BrewEntryForApp[]
): EntriesByStage {
  let current: brew_stage = initialStage;

  const map = new Map<brew_stage, BrewEntryForApp[]>();
  const push = (stage: brew_stage, entry: BrewEntryForApp) => {
    if (!map.has(stage)) map.set(stage, []);
    map.get(stage)!.push(entry);
  };

  for (const e of entries) {
    push(current, e);

    if (e.type === brew_entry_type.STAGE_CHANGE) {
      const to = (e.data as any)?.to;
      if (isBrewStage(to)) current = to;
    }
  }

  const order = Object.values(brew_stage);
  return order
    .filter((s) => map.has(s))
    .map((s) => ({ stage: s, entries: map.get(s)! }));
}

export async function createBrewEntryForApp(
  userId: number,
  brewId: string,
  input: CreateBrewEntryInput
): Promise<BrewForApp> {
  // ownership check
  const brew = await prisma.brews.findFirst({
    where: { id: brewId, user_id: userId },
    select: { id: true }
  });
  if (!brew) throw new Error("Brew not found");

  // Stage changes are handled ONLY through patchBrewMetadata
  if (input.type === brew_entry_type.STAGE_CHANGE) {
    const to =
      input.stage_to ?? ((input.data as any)?.to as brew_stage | undefined);
    if (!to) throw new Error("Missing stage_to");

    await patchBrewMetadata(userId, brewId, { stage: to });

    // consistent return
    return getBrewForApp(userId, brewId);
  }

  const dtRaw = input.datetime;
  const datetime =
    dtRaw == null
      ? new Date()
      : dtRaw instanceof Date
      ? dtRaw
      : new Date(dtRaw);
  if (Number.isNaN(datetime.getTime())) throw new Error("Invalid datetime");

  await prisma.brew_entries.create({
    data: {
      brew_id: brewId,
      user_id: userId,
      type: input.type,
      datetime,
      title: input.title ?? null,
      note: input.note ?? null,
      gravity: input.gravity ?? null,
      temperature: input.temperature ?? null,
      temp_units: input.temp_units ?? null,
      data: (input.data as any) ?? null
    }
  });

  // consistent return
  return getBrewForApp(userId, brewId);
}
export async function patchBrewEntryForApp(
  userId: number,
  brewId: string,
  entryId: string,
  input: PatchBrewEntryInput
) {
  return prisma.$transaction(async (tx) => {
    // 1) ownership check (entry must belong to brew, brew must belong to user)
    const entry = await tx.brew_entries.findFirst({
      where: {
        id: entryId,
        brew_id: brewId,
        brews: { user_id: userId }
      },
      select: {
        id: true,
        type: true
      }
    });

    if (!entry) throw new Error("Entry not found");

    const isStageChange = entry.type === brew_entry_type.STAGE_CHANGE;

    // 2) build update payload
    const data: Record<string, any> = {};

    const allow = (key: keyof PatchBrewEntryInput) => {
      if (isStageChange) return key === "datetime" || key === "note";
      return (
        key === "datetime" ||
        key === "title" ||
        key === "note" ||
        key === "gravity" ||
        key === "temperature" ||
        key === "temp_units" ||
        key === "data"
      );
    };

    for (const [k, v] of Object.entries(input ?? {})) {
      const key = k as keyof PatchBrewEntryInput;
      if (!allow(key)) continue;

      if (key === "datetime") {
        const d = v instanceof Date ? v : new Date(v as any);
        if (Number.isNaN(d.getTime())) throw new Error("Invalid datetime");
        data.datetime = d;
        continue;
      }

      if (key === "gravity" || key === "temperature") {
        if (v === null) data[key] = null;
        else {
          const n = Number(v);
          if (!Number.isFinite(n)) throw new Error(`Invalid ${key}`);
          data[key] = n;
        }
        continue;
      }

      if (key === "temp_units") {
        // allow null, otherwise Prisma enum validation will handle it
        data.temp_units = v === null ? null : v;
        continue;
      }

      if (key === "title" || key === "note") {
        if (v === null) data[key] = null;
        else data[key] = typeof v === "string" ? v : String(v);
        continue;
      }

      if (key === "data") {
        // replace-only
        data.data = v as any;
        continue;
      }
    }

    if (Object.keys(data).length === 0) {
      throw new Error("No valid fields to update");
    }

    // 3) persist
    await tx.brew_entries.update({
      where: { id: entryId },
      data
    });

    // 4) return the updated entry (consistent shape)
    return tx.brew_entries.findUnique({
      where: { id: entryId },
      select: {
        id: true,
        brew_id: true,
        user_id: true,
        datetime: true,
        type: true,
        title: true,
        note: true,
        gravity: true,
        temperature: true,
        temp_units: true,
        data: true
      }
    });
  });
}

export async function deleteBrewEntryForApp(
  userId: number,
  brewId: string,
  entryId: string
) {
  // Same ownership + stage-change rule
  const entry = await prisma.brew_entries.findFirst({
    where: {
      id: entryId,
      brew_id: brewId,
      brews: { user_id: userId }
    },
    select: { id: true, type: true }
  });

  if (!entry) throw new Error("Entry not found");

  // Option B: don’t allow deleting stage changes via this endpoint
  if (entry.type === brew_entry_type.STAGE_CHANGE) {
    throw new Error("Cannot delete stage change entry");
  }

  await prisma.brew_entries.delete({ where: { id: entryId } });
  return { message: "Entry deleted successfully." };
}

// brews.ts (additions)

export async function attachDeviceToBrewForApp(
  userId: number,
  brewId: string,
  input: AttachDeviceInput
) {
  const deviceId = input?.device_id;
  if (!deviceId) throw new Error("Missing device_id");

  return prisma.$transaction(async (tx) => {
    // ensure brew exists + ownership
    const brew = await tx.brews.findFirst({
      where: { id: brewId, user_id: userId },
      select: { id: true }
    });
    if (!brew) throw new Error("Brew not found");

    // ensure device exists + ownership
    const device = await tx.devices.findFirst({
      where: { id: deviceId, user_id: userId },
      select: { id: true, brew_id: true }
    });
    if (!device) throw new Error("Device not found");

    // idempotent: already attached to this brew
    if (device.brew_id === brewId) {
      return {
        message: "Device already attached",
        device_id: deviceId,
        brew_id: brewId
      };
    }

    // attached elsewhere -> only allow if force
    if (device.brew_id && device.brew_id !== brewId && !input.force) {
      throw new Error("Device already attached to another brew");
    }

    await tx.devices.updateMany({
      where: { id: deviceId, user_id: userId },
      data: { brew_id: brewId }
    });

    return { message: "Device attached", device_id: deviceId, brew_id: brewId };
  });
}

function parseDateOrThrow(v: any, label: string): Date {
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid ${label}`);
  return d;
}

export async function adoptLogsForBrewForApp(
  userId: number,
  brewId: string,
  input: AdoptLogsInput
) {
  const deviceId = input?.device_id;
  if (!deviceId) throw new Error("Missing device_id");

  return prisma.$transaction(async (tx) => {
    // ensure brew exists + ownership
    const brew = await tx.brews.findFirst({
      where: { id: brewId, user_id: userId },
      select: { id: true }
    });
    if (!brew) throw new Error("Brew not found");

    // ensure device exists + ownership
    const device = await tx.devices.findFirst({
      where: { id: deviceId, user_id: userId },
      select: { id: true }
    });
    if (!device) throw new Error("Device not found");

    const where: any = {
      device_id: deviceId
    };

    // range filter (optional)
    if (input.start_date || input.end_date) {
      where.datetime = {};
      if (input.start_date)
        where.datetime.gte = parseDateOrThrow(input.start_date, "start_date");
      if (input.end_date)
        where.datetime.lte = parseDateOrThrow(input.end_date, "end_date");
    }

    // default: only unassigned logs
    if (!("from_brew_id" in input)) {
      where.brew_id = null;
    } else {
      // explicit reparent from another brew (or null)
      where.brew_id = input.from_brew_id;
    }

    const res = await tx.logs.updateMany({
      where,
      data: { brew_id: brewId }
    });

    return {
      message: "Logs adopted",
      adopted_count: res.count,
      brew_id: brewId,
      device_id: deviceId
    };
  });
}

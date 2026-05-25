import INGREDIENTS from "./seed-data/ingredients_rows.json";
import YEASTS from "./seed-data/yeasts_rows.json";
import ADDITIVES from "./seed-data/additives.json";
import RECIPES from "./seed-data/recipes_rows.json";
import COMMENTS from "./seed-data/comments_rows.json";
import RATINGS from "./seed-data/recipe_ratings_rows.json";
import prisma from "../lib/prisma";
import bcrypt from "bcrypt";
import ShortUniqueId from "short-unique-id";
import { addRecipeToBrew, endBrew, startBrew } from "@/lib/db/iSpindel";
import {
  brew_entry_type,
  brew_stage,
  Prisma,
  temp_units
} from "@prisma/client";

if (process.env.NODE_ENV === "production") {
  console.error("Seeding is disabled in production.");
  process.exit(1);
}
async function main() {
  assertSeedSafe();
  // Drop and recreate tables is unnecessary; Prisma migrations handle this.
  await clearDb();
  // Seed users
  const adminEmail = process.env.ADMIN_EMAIL || "";
  const adminPassword = process.env.ADMIN_PASSWORD
    ? await bcrypt.hash(process.env.ADMIN_PASSWORD, 10)
    : null;

  const userEmail = process.env.USER_EMAIL || "";
  const userPassword = process.env.USER_PASSWORD
    ? await bcrypt.hash(process.env.USER_PASSWORD, 10)
    : null;

  const { randomUUID } = new ShortUniqueId();
  const adminToken = randomUUID(10);
  const userToken = randomUUID(10);

  const users = await prisma.users.createManyAndReturn({
    data: [
      {
        email: adminEmail,
        password: adminPassword,
        role: "admin",
        public_username: "MeadTools Admin",
        hydro_token: adminToken
      },
      {
        email: userEmail,
        password: userPassword,
        role: "user",
        public_username: "MeadTools User",
        hydro_token: userToken
      }
    ]
  });

  console.log("Users seeded");
  const userIds = users.map((u) => u.id);
  // Seed ingredients
  await prisma.ingredients.createMany({ data: INGREDIENTS });
  console.log("Ingredients seeded");

  // Seed yeasts
  await prisma.yeasts.createMany({ data: YEASTS });
  console.log("Yeasts seeded");

  // @ts-expect-error additives in correct type format, json pulled directly from DB
  await prisma.additives.createMany({ data: ADDITIVES });
  console.log("Additives seeded.");

  const hydrometerSeedUser =
    users.find((user) => user.role === "user") ?? users[0];
  const devices = await Promise.all(
    ["Active", "Planning", "Completed", "Available"].map((scenario) =>
      prisma.devices.create({
        data: {
          device_name: `${scenario} Test Hydrometer`,
          user_id: hydrometerSeedUser.id
        }
      })
    )
  );

  console.log("Devices Seeded");

  // recipes
  const recipes = await prisma.recipes.createManyAndReturn({
    data: RECIPES.map((r, i) => ({
      ...r,
      user_id: userIds[i % userIds.length],
      dataV2: JSON.parse(r.dataV2)
    }))
  });
  const recipeIds = recipes.map((r) => r.id);
  const hydrometerSeedRecipe =
    recipes.find(
      (recipe) =>
        recipe.user_id === hydrometerSeedUser.id &&
        recipe.name === "Key Lime Pie"
    ) ??
    recipes.find((recipe) => recipe.user_id === hydrometerSeedUser.id) ??
    recipes[0];
  console.log("Recipes Seeded");

  // comments
  await prisma.comments.createMany({
    data: COMMENTS.map((c, i) => ({
      ...c,
      user_id: userIds[i % userIds.length],
      recipe_id: recipeIds[i % recipeIds.length],
      created_at: new Date(c.created_at),
      updated_at: new Date(c.updated_at),
      deleted_at: c.deleted_at?.length ? new Date(c.deleted_at) : undefined
    }))
  });
  console.log("Recipe Comments Seeded");

  // ratings
  await prisma.recipe_ratings.createMany({
    data: RATINGS.map((r, i) => ({
      ...r,
      user_id: userIds[i % userIds.length],
      recipe_id: recipeIds[i % recipeIds.length],
      created_at: new Date(r.created_at),
      updated_at: new Date(r.updated_at)
    }))
  });
  console.log("Recipe Ratings seeded.");

  await Promise.all(
    devices
      .filter((device) => !device.device_name?.startsWith("Available"))
      .map((device) => {
        const prefix =
          device.device_name?.replace(" Test Hydrometer", "") || "Active";
        return startBrew(device.id, device.user_id, `${prefix} Test Brew`);
      })
  );

  const planningBrew = await prisma.brews.findFirst({
    where: {
      user_id: hydrometerSeedUser.id,
      name: "Planning Test Brew"
    },
    select: { id: true }
  });

  if (planningBrew && hydrometerSeedRecipe) {
    await addRecipeToBrew(
      hydrometerSeedRecipe.id,
      planningBrew.id,
      hydrometerSeedUser.id
    );
  }

  const completedBrew = await prisma.brews.findFirst({
    where: {
      user_id: hydrometerSeedUser.id,
      name: "Completed Test Brew"
    },
    select: { id: true }
  });

  if (completedBrew && hydrometerSeedRecipe) {
    await addRecipeToBrew(
      hydrometerSeedRecipe.id,
      completedBrew.id,
      hydrometerSeedUser.id
    );
    await prisma.brews.update({
      where: { id: completedBrew.id },
      data: { name: "Completed Key Lime Pie Test Brew" }
    });
  }

  await prisma.brews.create({
    data: {
      user_id: hydrometerSeedUser.id,
      name: "Unlinked Test Brew",
      stage: brew_stage.PRIMARY,
      start_date: new Date()
    }
  });

  console.log("Brews Seeded");

  await generateLogs();
  await generateBrewEntries();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

function clamp(x: number, min: number, max: number) {
  return Math.max(min, Math.min(max, x));
}

// Box-Muller for normal-ish noise
function randn() {
  let u = 0,
    v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function gallonsToLiters(gallons: number) {
  return gallons * 3.785411784;
}

export async function generateLogs() {
  const brews = await prisma.brews.findMany();
  const devices = await prisma.devices.findMany();

  for (const brew of brews) {
    if (brew.name?.startsWith("Planning")) continue;

    const device = devices.find((d) => d.brew_id === brew.id);
    if (!device) continue;

    // Make re-runs stable per brew by clearing existing logs
    await prisma.logs.deleteMany({ where: { brew_id: brew.id } });

    const isCompletedRecipeBrew = brew.name?.startsWith("Completed Key Lime Pie");
    const durationDays = isCompletedRecipeBrew ? 14 : 7;
    const logStart = new Date(
      Date.now() - durationDays * 24 * 60 * 60 * 1000
    );

    await prisma.brews.update({
      where: { id: brew.id },
      data: { start_date: logStart }
    });

    const lastGravity = await createHydrometerLogSeries({
      brewId: brew.id,
      deviceId: device.id,
      startDate: logStart,
      durationDays,
      gStart: isCompletedRecipeBrew ? 1.06 : 1.1,
      gEnd: isCompletedRecipeBrew ? 0.996 : 1,
      tempTarget: isCompletedRecipeBrew ? 66 : 70
    });

    await prisma.brews.update({
      where: { id: brew.id },
      data: { latest_gravity: Number(lastGravity.toFixed(4)) }
    });

    if (brew.name?.startsWith("Completed")) {
      await endBrew(device.id, brew.id, device.user_id);
    }
  }
}

async function createHydrometerLogSeries({
  brewId,
  deviceId,
  startDate,
  durationDays = 7,
  gStart = 1.1,
  gEnd = 1,
  tempTarget = 70
}: {
  brewId: string | null;
  deviceId: string;
  startDate?: Date;
  durationDays?: number;
  gStart?: number;
  gEnd?: number;
  tempTarget?: number;
}) {
  const intervalMinutes = 15;
  const intervalMs = intervalMinutes * 60 * 1000;

  const now = startDate
    ? new Date(startDate.getTime() + durationDays * 24 * 60 * 60 * 1000)
    : new Date();
  const start =
    startDate ?? new Date(now.getTime() - durationDays * 24 * 60 * 60 * 1000);
  const steps = Math.floor((now.getTime() - start.getTime()) / intervalMs);

  // --- Temperature: gentle random walk ---
  let temp = tempTarget + randn() * 0.6; // start near target
  const maxTempStep = 0.25; // max change per reading (15m)

  // --- Gravity: downward trend + jitter ---
  let lastGravity = gStart;

  for (let step = 0; step <= steps; step++) {
    const t = step / steps;
    const datetime = new Date(start.getTime() + step * intervalMs);

    // Base gravity trend (slightly curved so it slows near the end)
    const curved = 1 - Math.pow(1 - t, 2); // ease out
    const baseGravity = lerp(gStart, gEnd, curved);

    // Measurement noise (tiny) + occasional positive blip
    const noise = randn() * 0.0006; // ~±0.001-ish range
    const blip = Math.random() < 0.03 ? Math.abs(randn()) * 0.0015 : 0; // 3% chance

    // Combine, but keep it mostly non-increasing (allow tiny rises)
    let gravity = baseGravity + noise + blip;

    // Prevent insane jumps compared to last reading
    const maxJump = 0.003; // max 0.003 SG between adjacent readings
    gravity = clamp(gravity, lastGravity - maxJump, lastGravity + maxJump);

    // Keep within plausible bounds
    gravity = clamp(gravity, gEnd, gStart);

    // Update lastGravity but also ensure it *eventually* reaches gEnd
    lastGravity = gravity;

    // Temp update: mean-reverting random walk + bounded step
    // Pull slightly toward 70 + small noise, then clamp per-step and overall range.
    const proposed =
      temp +
      (tempTarget - temp) * 0.05 + // mean reversion
      randn() * 0.12; // random component

    const stepLimited = clamp(
      proposed,
      temp - maxTempStep,
      temp + maxTempStep
    );
    temp = clamp(stepLimited, 65, 75);

    // Angle: correlate with gravity but with some noise
    const angleBase = lerp(25, 65, curved);
    const angle = clamp(angleBase + randn() * 1.2, 10, 80);

    // Battery: slow decline with tiny noise
    const battery = clamp(lerp(4.2, 3.8, t) + randn() * 0.01, 3.6, 4.25);

    await prisma.logs.create({
      data: {
        datetime,
        angle: Number(angle.toFixed(2)),
        temperature: Number(temp.toFixed(2)),
        temp_units: "F",
        battery: Number(battery.toFixed(2)),
        gravity: Number(gravity.toFixed(4)),
        calculated_gravity: Number(gravity.toFixed(4)),
        interval: intervalMinutes * 60, // adjust if your app expects minutes
        brew_id: brewId,
        device_id: deviceId
      }
    });
  }

  return lastGravity;
}

async function clearDb() {
  // Order matters because of FKs
  await prisma.logs.deleteMany();
  await prisma.brew_entries.deleteMany(); // <-- add this
  await prisma.devices.deleteMany();
  await prisma.brews.deleteMany();

  await prisma.recipe_daily_activity.deleteMany();
  await prisma.recipe_ratings.deleteMany();
  await prisma.comments.deleteMany();

  await prisma.recipes.deleteMany();

  await prisma.ingredients.deleteMany();
  await prisma.yeasts.deleteMany();
  await prisma.additives.deleteMany();

  await prisma.users.deleteMany();

  console.log("✅ Database cleared");
}

function assertSafeDatabaseUrl() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");

  // Parse safely
  let host = "";
  let db = "";
  try {
    const u = new URL(url);
    host = u.hostname;
    db = u.pathname.replace("/", "");
  } catch {
    throw new Error("DATABASE_URL is not a valid URL");
  }

  // Block known prod-ish hosts
  const bannedHostSnippets = [
    "supabase.co",
    "pooler.supabase.com",
    "aws.neon.tech",
    "render.com",
    "railway.app"
  ];

  if (bannedHostSnippets.some((s) => host.includes(s))) {
    throw new Error(
      `Refusing to run: DATABASE_URL points at hosted DB (${host}).`
    );
  }

  // Optional: require local docker db name prefix
  const allowedDbNames = ["meadtools_dev", "meadtools_test"];
  if (!allowedDbNames.includes(db)) {
    throw new Error(
      `Refusing to run: database name "${db}" is not in ${allowedDbNames.join(
        ", "
      )}`
    );
  }
}

function assertSeedSafe() {
  // Extra explicit opt-in (prevents “oops I ran it”)
  if (process.env.ALLOW_DB_RESET !== "true") {
    throw new Error(
      'Refusing to run: set ALLOW_DB_RESET="true" to allow seed/clear.'
    );
  }
  assertSafeDatabaseUrl();
}
export async function generateBrewEntries() {
  const brews = await prisma.brews.findMany({
    orderBy: [{ name: "asc" }, { start_date: "asc" }],
    select: {
      id: true,
      name: true,
      user_id: true,
      start_date: true,
      end_date: true,
      stage: true,
      recipe_id: true,
      recipes: {
        select: {
          name: true,
          dataV2: true
        }
      },
      devices: { select: { id: true } }
    }
  });

  for (const brew of brews) {
    if (!brew.user_id) continue;

    // Make reruns stable
    await prisma.brew_entries.deleteMany({ where: { brew_id: brew.id } });

    if (brew.name?.startsWith("Planning")) {
      await prisma.brews.update({
        where: { id: brew.id },
        data: { stage: brew_stage.PLANNED, end_date: null }
      });
      continue;
    }

    if (brew.name?.startsWith("Completed Key Lime Pie")) {
      await seedCompletedKeyLimePieEntries(brew);
      continue;
    }

    const t0 = new Date(brew.start_date.getTime() + 1 * 60 * 60 * 1000);
    const t1 = new Date(brew.start_date.getTime() + 6 * 60 * 60 * 1000);
    const t2 = new Date(brew.start_date.getTime() + 18 * 60 * 60 * 1000);
    const t3 = new Date(brew.start_date.getTime() + 36 * 60 * 60 * 1000);
    const t4 = new Date(brew.start_date.getTime() + 54 * 60 * 60 * 1000);

    await prisma.brews.update({
      where: { id: brew.id },
      data: {
        stage: brew.name?.startsWith("Completed")
          ? brew_stage.COMPLETE
          : brew_stage.PRIMARY,
        ...(brew.name?.startsWith("Completed") ? {} : { end_date: null })
      }
    });

    await prisma.brew_entries.createMany({
      data: [
        // Stage change: PLANNED -> PRIMARY
        {
          brew_id: brew.id,
          user_id: brew.user_id,
          datetime: t0,
          type: brew_entry_type.STAGE_CHANGE,
          title: "Stage change",
          note: null,
          data: {
            from: brew_stage.PLANNED,
            to: brew_stage.PRIMARY,
            source: "seed"
          } as Prisma.JsonObject
        },

        // A note
        {
          brew_id: brew.id,
          user_id: brew.user_id,
          datetime: t1,
          type: brew_entry_type.GRAVITY,
          title: "Original gravity",
          note: null,
          gravity: 1.1,
          data: {
            readingRole: "OG",
            source: "measured"
          } as Prisma.JsonObject
        },

        {
          brew_id: brew.id,
          user_id: brew.user_id,
          datetime: t2,
          type: brew_entry_type.NOTE,
          title: "Started fermentation",
          note: "Pitched yeast and set airlock. Keeping this one simple for seed data.",
          data: Prisma.JsonNull
        },

        {
          brew_id: brew.id,
          user_id: brew.user_id,
          datetime: t3,
          type: brew_entry_type.GRAVITY,
          title: "Gravity reading",
          note: null,
          gravity: 1.055,
          data: {
            readingRole: "GENERAL",
            source: "measured"
          } as Prisma.JsonObject
        },

        {
          brew_id: brew.id,
          user_id: brew.user_id,
          datetime: t3,
          type: brew_entry_type.TEMPERATURE,
          title: "Temperature check",
          note: null,
          temperature: 70,
          temp_units: temp_units.F,
          data: Prisma.JsonNull
        },

        {
          brew_id: brew.id,
          user_id: brew.user_id,
          datetime: t4,
          type: brew_entry_type.PH,
          title: "pH reading",
          note: null,
          data: { ph: 3.42 } as Prisma.JsonObject
        },

        ...(brew.name?.startsWith("Completed")
          ? ([
              {
                brew_id: brew.id,
                user_id: brew.user_id,
                datetime: new Date(t4.getTime() + 12 * 60 * 60 * 1000),
                type: brew_entry_type.STAGE_CHANGE,
                title: "Stage change",
                note: "Marking brew complete (seed).",
                data: {
                  from: brew_stage.PRIMARY,
                  to: brew_stage.COMPLETE,
                  source: "seed"
                } as Prisma.JsonObject
              }
            ] as any[])
          : [])
      ]
    });
  }

  console.log("Brew entries seeded");
}

async function seedCompletedKeyLimePieEntries(brew: {
  id: string;
  name: string | null;
  user_id: number | null;
  start_date: Date;
  recipe_id: number | null;
  recipes: { name: string | null; dataV2: Prisma.JsonValue } | null;
}) {
  if (!brew.user_id) return;

  const t0 = new Date(brew.start_date.getTime() + 1 * 60 * 60 * 1000);
  const t1 = new Date(brew.start_date.getTime() + 6 * 60 * 60 * 1000);
  const t2 = new Date(brew.start_date.getTime() + 12 * 60 * 60 * 1000);
  const t3 = new Date(brew.start_date.getTime() + 2 * 24 * 60 * 60 * 1000);
  const t4 = new Date(brew.start_date.getTime() + 5 * 24 * 60 * 60 * 1000);
  const t5 = new Date(brew.start_date.getTime() + 10 * 24 * 60 * 60 * 1000);
  const t6 = new Date(brew.start_date.getTime() + 11 * 24 * 60 * 60 * 1000);
  const t7 = new Date(brew.start_date.getTime() + 12 * 24 * 60 * 60 * 1000);
  const t8 = new Date(brew.start_date.getTime() + 13 * 24 * 60 * 60 * 1000);
  const completeAt = new Date(brew.start_date.getTime() + 14 * 24 * 60 * 60 * 1000);

  const primaryVolumeGal = 5.0075;
  const secondaryVolumeGal = 5.54;
  const packagedVolumeGal = 5.25;

  await prisma.brews.update({
    where: { id: brew.id },
    data: {
      stage: brew_stage.COMPLETE,
      end_date: completeAt,
      current_volume_liters: gallonsToLiters(packagedVolumeGal),
      latest_gravity: 0.996
    }
  });

  await prisma.brew_entries.createMany({
    data: [
      {
        brew_id: brew.id,
        user_id: brew.user_id,
        datetime: t0,
        type: brew_entry_type.STAGE_CHANGE,
        title: "Stage change",
        note: null,
        data: {
          from: brew_stage.PLANNED,
          to: brew_stage.PRIMARY,
          source: "seed"
        } as Prisma.JsonObject
      },
      {
        brew_id: brew.id,
        user_id: brew.user_id,
        datetime: t1,
        type: brew_entry_type.VOLUME,
        title: "Volume recorded",
        note: "Primary batch volume from the Key Lime Pie recipe.",
        data: {
          liters: gallonsToLiters(primaryVolumeGal),
          displayValue: primaryVolumeGal,
          displayUnit: "gal"
        } as Prisma.JsonObject
      },
      {
        brew_id: brew.id,
        user_id: brew.user_id,
        datetime: t1,
        type: brew_entry_type.GRAVITY,
        title: "Original gravity",
        note: "Matches the Key Lime Pie recipe target.",
        gravity: 1.06,
        data: {
          readingRole: "OG",
          source: "measured",
          recipeValue: 1.06
        } as Prisma.JsonObject
      },
      {
        brew_id: brew.id,
        user_id: brew.user_id,
        datetime: t1,
        type: brew_entry_type.TEMPERATURE,
        title: "Temperature check",
        note: "D47 fermentation temperature.",
        temperature: 66,
        temp_units: temp_units.F,
        data: Prisma.JsonNull
      },
      {
        brew_id: brew.id,
        user_id: brew.user_id,
        datetime: t2,
        type: brew_entry_type.ADDITION,
        title: "Honey",
        note: "Primary honey addition from recipe.",
        data: {
          kind: "INGREDIENT",
          source: "recipe_ingredient",
          name: "Honey",
          amount: 8,
          unit: "lb",
          recipeIngredientId: "8wmg6sg23q"
        } as Prisma.JsonObject
      },
      {
        brew_id: brew.id,
        user_id: brew.user_id,
        datetime: t3,
        type: brew_entry_type.GRAVITY,
        title: "Gravity reading",
        note: "Fermentation is active.",
        gravity: 1.032,
        data: {
          readingRole: "GENERAL",
          source: "measured"
        } as Prisma.JsonObject
      },
      {
        brew_id: brew.id,
        user_id: brew.user_id,
        datetime: t3,
        type: brew_entry_type.PH,
        title: "pH reading",
        note: "Bright acidity from lime must.",
        data: { ph: 3.28 } as Prisma.JsonObject
      },
      {
        brew_id: brew.id,
        user_id: brew.user_id,
        datetime: t4,
        type: brew_entry_type.GRAVITY,
        title: "Gravity reading",
        note: "Approaching terminal gravity.",
        gravity: 1.006,
        data: {
          readingRole: "GENERAL",
          source: "measured"
        } as Prisma.JsonObject
      },
      {
        brew_id: brew.id,
        user_id: brew.user_id,
        datetime: t5,
        type: brew_entry_type.GRAVITY,
        title: "Final gravity",
        note: "Finished at the recipe FG.",
        gravity: 0.996,
        data: {
          readingRole: "FG",
          source: "measured",
          recipeValue: 0.996
        } as Prisma.JsonObject
      },
      {
        brew_id: brew.id,
        user_id: brew.user_id,
        datetime: t5,
        type: brew_entry_type.STAGE_CHANGE,
        title: "Stage change",
        note: "Primary fermentation complete.",
        data: {
          from: brew_stage.PRIMARY,
          to: brew_stage.SECONDARY,
          source: "seed"
        } as Prisma.JsonObject
      },
      {
        brew_id: brew.id,
        user_id: brew.user_id,
        datetime: t6,
        type: brew_entry_type.ADDITION,
        title: "Key Lime Juice",
        note: "Secondary addition from recipe.",
        data: {
          kind: "INGREDIENT",
          source: "recipe_ingredient",
          name: "Key Lime Juice",
          amount: 2.0972,
          unit: "lb",
          recipeIngredientId: "gbl0yyixla"
        } as Prisma.JsonObject
      },
      {
        brew_id: brew.id,
        user_id: brew.user_id,
        datetime: t6,
        type: brew_entry_type.ADDITION,
        title: "Lactose",
        note: "Creamy pie-style body.",
        data: {
          kind: "OTHER",
          source: "recipe_additive",
          name: "Lactose",
          amount: 1,
          unit: "lbs",
          recipeAdditiveId: "4oo64hlfm4"
        } as Prisma.JsonObject
      },
      {
        brew_id: brew.id,
        user_id: brew.user_id,
        datetime: t7,
        type: brew_entry_type.VOLUME,
        title: "Volume recorded",
        note: "Volume after secondary Key Lime Pie additions.",
        data: {
          liters: gallonsToLiters(secondaryVolumeGal),
          displayValue: secondaryVolumeGal,
          displayUnit: "gal",
          startingLiters: gallonsToLiters(primaryVolumeGal)
        } as Prisma.JsonObject
      },
      {
        brew_id: brew.id,
        user_id: brew.user_id,
        datetime: t7,
        type: brew_entry_type.PH,
        title: "pH reading",
        note: "Post-lime addition pH.",
        data: { ph: 3.18 } as Prisma.JsonObject
      },
      {
        brew_id: brew.id,
        user_id: brew.user_id,
        datetime: t8,
        type: brew_entry_type.PACKAGING,
        title: "Packaged",
        note: "Packaged sample batch.",
        data: {
          packagedVolumeLiters: gallonsToLiters(packagedVolumeGal),
          displayValue: packagedVolumeGal,
          displayUnit: "gal"
        } as Prisma.JsonObject
      },
      {
        brew_id: brew.id,
        user_id: brew.user_id,
        datetime: completeAt,
        type: brew_entry_type.STAGE_CHANGE,
        title: "Stage change",
        note: "Completed and ready for chart testing.",
        data: {
          from: brew_stage.SECONDARY,
          to: brew_stage.COMPLETE,
          source: "seed"
        } as Prisma.JsonObject
      }
    ]
  });
}

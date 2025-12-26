import { Prisma, PrismaClient } from "@prisma/client";
import fs from "node:fs";

const prisma = new PrismaClient();
function normalizeStringArray(input: unknown): string[] {
  // already an array
  if (Array.isArray(input)) {
    return input.filter((x): x is string => typeof x === "string");
  }

  if (typeof input !== "string") return [];

  const s = input.trim();
  if (!s) return [];

  // if it's a JSON-stringified array, parse it
  if (s.startsWith("[") && s.endsWith("]")) {
    try {
      const parsed = JSON.parse(s) as unknown;
      if (Array.isArray(parsed)) {
        return parsed
          .filter((x): x is string => typeof x === "string")
          .map((x) => x); // keep as-is
      }
    } catch {
      // fall through
    }
  }

  // otherwise treat as a single note line
  return [s];
}

async function main() {
  const raw = fs.readFileSync("prisma/legacy-recipes.json", "utf8");
  const recipes = JSON.parse(raw);

  if (!Array.isArray(recipes)) {
    throw new Error("legacy-recipes.json must be an array");
  }

  for (const r of recipes) {
    await prisma.recipes.create({
      data: {
        name: r.name,
        user_id: 1,

        recipeData: r.recipeData ?? "",
        nutrientData: r.nutrientData ?? "",
        yanContribution: r.yanContribution ?? '["40","100","210","0"]',
        yanFromSource: r.yanFromSource ?? null,
        nuteInfo: r.nuteInfo ?? null,

        primaryNotes: normalizeStringArray(r.primaryNotes),
        secondaryNotes: normalizeStringArray(r.secondaryNotes),

        advanced: r.advanced ?? false,
        private: r.private ?? false,

        lastActivityEmailAt: r.lastActivityEmailAt ?? null,
        activityEmailsEnabled: r.activityEmailsEnabled ?? false,

        dataV2: Prisma.DbNull,
        version: 1
      }
    });
  }

  console.log(`Inserted ${recipes.length} legacy recipes`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

// lib/migrateTutorialData.ts
import fs from "node:fs";
import path from "node:path";

import type { RecipeApiResponse } from "@/hooks/reactQuery/useRecipeQuery";
import { migrateLegacyRecipeToV2 } from "@/lib/utils/migrateLegacyData";

/**
 * One-time generator for the tutorial recipe file.
 *
 * Reads legacy tutorial recipe JSON -> produces V2 tutorial JSON.
 *
 * Recommended usage:
 *   bun lib/migrateTutorialData.ts
 *   (or node/tsx)
 */

// Adjust if your paths differ
const INPUT = path.join(process.cwd(), "data/tutorialRecipe.json");
const OUTPUT = path.join(process.cwd(), "data/tutorialRecipe.v2.json");

type TutorialLegacyFile = {
  recipe: RecipeApiResponse & {
    // your legacy file has users nested sometimes
    users?: { public_username?: string | null } | null;
    public_username?: string | null;
  };
};

type TutorialV2File = {
  recipe: {
    id: number;
    user_id: number | null;
    name: string;
    private: boolean;

    // keep whatever your UI expects
    public_username: string | null;
    averageRating?: number;
    numberOfRatings?: number;
    activityEmailsEnabled?: boolean;

    // ✅ new canonical
    dataV2: ReturnType<typeof migrateLegacyRecipeToV2>;
  };
};

export function migrateTutorialJson(raw: TutorialLegacyFile): TutorialV2File {
  const legacy = raw.recipe;

  const dataV2 = migrateLegacyRecipeToV2(legacy);

  const public_username =
    legacy.public_username ?? legacy.users?.public_username ?? null;

  return {
    recipe: {
      id: legacy.id,
      user_id: legacy.user_id ?? null,
      name: legacy.name,
      private: !!legacy.private,
      public_username,

      // keep these if you’re showing them anywhere
      averageRating: legacy.averageRating ?? 0,
      numberOfRatings:
        // some responses use ratings array length; some already have numberOfRatings
        (legacy as any).numberOfRatings ?? (legacy as any).ratings?.length ?? 0,
      activityEmailsEnabled: !!legacy.activityEmailsEnabled,

      dataV2
    }
  };
}

function main() {
  const rawStr = fs.readFileSync(INPUT, "utf8");
  const parsed = JSON.parse(rawStr) as TutorialLegacyFile;

  if (!parsed?.recipe) {
    throw new Error(
      "tutorialRecipe.json must have a top-level { recipe: ... }"
    );
  }

  const migrated = migrateTutorialJson(parsed);

  fs.writeFileSync(OUTPUT, JSON.stringify(migrated, null, 2), "utf8");
  console.log(`Wrote: ${OUTPUT}`);
}

// Allow import without executing
if (require.main === module) {
  main();
}

// hooks/useRecipeQuery.ts (or lib/db/useRecipeQuery.ts)

import { useQuery } from "@tanstack/react-query";
import { useFetchWithAuth } from "@/lib/useFetchWithAuth";
import { qk } from "@/lib/db/queryKeys";
import { parseRecipeData } from "@/lib/utils/parseRecipeData";

export type RecipeApiResponse = {
  id: number;
  name: string;
  user_id: number | null;

  // JSON-encoded blobs in DB:
  recipeData: string;
  nutrientData: string;
  yanContribution: string;
  yanFromSource: string;
  nuteInfo: string;

  private: boolean;

  // from concatNotes(...) in getRecipeInfo
  primaryNotes: [string, string][];
  secondaryNotes: [string, string][];

  // denormalized owner info
  public_username: string | null;

  // activity/email
  lastActivityEmailAt: string | null; // comes over JSON as string

  // social
  comments: any[]; // you can refine this later if you want
  ratings: Array<{ rating: number; user_id: number }>;

  averageRating: number | null;
  commentCount: number;
};

// Top-level API shape
type RecipeResponse = { recipe: RecipeApiResponse };

// What the hook returns: raw API fields + parsed fields from parseRecipeData
export type RecipeWithParsedFields = RecipeApiResponse &
  ReturnType<typeof parseRecipeData>;

async function fetchPublicRecipe(id: string): Promise<RecipeApiResponse> {
  const res = await fetch(`/api/recipes/${id}`);

  if (!res.ok) {
    const err: any = new Error(`HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }

  const json = (await res.json()) as RecipeResponse;
  return json.recipe;
}

export function useRecipeQuery(id: string, isLoggedIn: boolean) {
  const fetchWithAuth = useFetchWithAuth();

  return useQuery<RecipeWithParsedFields>({
    queryKey: qk.recipe(id),

    queryFn: async () => {
      let baseRecipe: RecipeApiResponse;

      // 🔓 Not logged in at all → always use public endpoint
      if (!isLoggedIn) {
        baseRecipe = await fetchPublicRecipe(id);
      } else {
        // 🔐 Logged in → try authed endpoint first
        try {
          const json = await fetchWithAuth<RecipeResponse>(
            `/api/recipes/${id}`
          );
          baseRecipe = json.recipe;
        } catch (err: any) {
          // If your fetchWithAuth throws a special NO_TOKEN error when token
          // isn't ready, treat it like a public request instead of blowing up.
          if (err.code === "NO_TOKEN") {
            baseRecipe = await fetchPublicRecipe(id);
          } else {
            // Real HTTP errors (403/404/500) bubble up with status
            throw err;
          }
        }
      }

      // Parse all the JSON blobs + derive extra fields
      const parsed = parseRecipeData(baseRecipe);

      // Return merged object: DB fields + parsed fields + helpers
      return {
        ...baseRecipe,
        ...parsed
      };
    },

    retry: false
  });
}

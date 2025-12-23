// hooks/useRecipeQuery.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useFetchWithAuth } from "@/hooks/auth/useFetchWithAuth";
import { qk } from "@/lib/db/queryKeys";
import { parseRecipeData } from "@/lib/utils/parseRecipeData";
import { useAuthToken } from "@/hooks/auth/useAuthToken";
import { RecipeDataV2 } from "@/types/recipeDataV2";

// --- Raw API shape from /api/recipes/:id ---
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

  // from concatNotes(...)
  primaryNotes: [string, string][];
  secondaryNotes: [string, string][];

  // new pattern
  dataV2?: RecipeDataV2;

  // owner info
  public_username: string | null;

  // social
  comments: any[];
  ratings: Array<{ rating: number; user_id: number }>;

  averageRating: number | null;
  commentCount: number;
  activityEmailsEnabled: boolean;
};

type RecipeResponse = { recipe: RecipeApiResponse };

// --- Shared payload shape for create/update ---
type BaseRecipePayload = {
  name: string;
  private: boolean;
  activityEmailsEnabled: boolean;

  // ✅ new (preferred going forward)
  dataV2?: RecipeDataV2;

  // legacy (keep optional during migration)
  recipeData?: string;
  yanFromSource?: string | null;
  yanContribution?: string;
  nutrientData?: string;
  advanced?: boolean;
  nuteInfo?: string | null;
  primaryNotes?: string[];
  secondaryNotes?: string[];
};

export type UpdateRecipePayload = BaseRecipePayload;
export type CreateRecipePayload = BaseRecipePayload;

// --- Parsed shape returned by useRecipeQuery ---
export type RecipeWithParsedFields = RecipeApiResponse &
  ReturnType<typeof parseRecipeData>;

export function getLastActivityEmailAt(
  isPrivate: boolean,
  notify?: boolean
): string | null {
  if (isPrivate || !notify) return null;

  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return yesterday.toISOString();
}

type BuildRecipePayloadArgs = {
  name: string;
  privateRecipe: boolean;
  emailNotifications: boolean; // 👈 instead of notify?

  // recipe data
  ingredients: any;
  OG: any;
  volume: any;
  ABV: any;
  FG: any;
  offset: any;
  units: any;
  additives: any;
  sorbate: any;
  sulfite: any;
  campden: any;
  stabilizers?: any;
  stabilizerType?: any;

  // notes
  notes: {
    primary: Array<{ content: string[] }>;
    secondary: Array<{ content: string[] }>;
  };

  // nutrient data
  fullData: any;
  yanContributions: any;
  otherNutrientNameValue?: string;
  providedYan: any;
  maxGpl: any;
};

export function buildRecipePayload(
  args: BuildRecipePayloadArgs
): BaseRecipePayload {
  const {
    name,
    privateRecipe,
    emailNotifications, // 👈
    ingredients,
    OG,
    volume,
    ABV,
    FG,
    offset,
    units,
    additives,
    sorbate,
    sulfite,
    campden,
    stabilizers,
    stabilizerType,
    notes,
    fullData,
    yanContributions,
    otherNutrientNameValue,
    providedYan,
    maxGpl
  } = args;

  const recipeData = JSON.stringify({
    ingredients,
    OG,
    volume,
    ABV,
    FG,
    offset,
    units,
    additives,
    sorbate,
    sulfite,
    campden,
    stabilizers,
    stabilizerType
  });

  const otherNutrientName =
    otherNutrientNameValue && otherNutrientNameValue.length > 0
      ? otherNutrientNameValue
      : undefined;

  const nutrientData = JSON.stringify({
    ...fullData,
    otherNutrientName
  });

  const yanContribution = JSON.stringify(yanContributions);

  const primaryNotes = notes.primary.map((note) => note.content).flat();
  const secondaryNotes = notes.secondary.map((note) => note.content).flat();
  const advanced = false;

  return {
    name,
    recipeData,
    yanFromSource: JSON.stringify(providedYan),
    yanContribution,
    nutrientData,
    advanced,
    nuteInfo: JSON.stringify(maxGpl),
    primaryNotes,
    secondaryNotes,
    private: privateRecipe,
    activityEmailsEnabled: emailNotifications // 👈 opt-in flag
  };
}
// Public endpoint (no auth header)
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
  const token = useAuthToken();

  // Logged-out: we don't care about token
  // Logged-in: don't run the query until we actually *have* a token
  const hasToken = !!token;
  const enabled = !isLoggedIn || hasToken;

  return useQuery<RecipeWithParsedFields>({
    queryKey: qk.recipe(id),
    enabled, // ⬅️ this is the key part

    queryFn: async () => {
      let base: RecipeApiResponse;

      if (!isLoggedIn) {
        // Public user → public endpoint
        base = await fetchPublicRecipe(id);
      } else {
        // Logged-in user → authed endpoint with Authorization header
        const json = await fetchWithAuth<RecipeResponse>(`/api/recipes/${id}`);
        base = json.recipe;
      }

      if (base.dataV2)
        return {
          ...base,
          averageRating: base.averageRating ?? 0,
          numberOfRatings: base?.ratings?.length ?? 0,
          emailNotifications: base.activityEmailsEnabled
        } as RecipeWithParsedFields;

      // Parse JSON blobs into shaped data
      const parsed = parseRecipeData(base);

      // Merge raw + parsed into a single object for the client
      return {
        ...base,
        ...parsed
      };
    },

    retry: false
  });
}

// PATCH /api/recipes/:id
export function useUpdateRecipeMutation() {
  const fetchWithAuth = useFetchWithAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      body
    }: {
      id: string;
      body: UpdateRecipePayload;
    }) => {
      return await fetchWithAuth<RecipeResponse>(`/api/recipes/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      });
    },
    onSuccess: (_data, variables) => {
      // refresh this specific recipe
      queryClient.invalidateQueries({ queryKey: qk.recipe(variables.id) });
    }
  });
}

// POST /api/recipes
export function useCreateRecipeMutation() {
  const fetchWithAuth = useFetchWithAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: [...qk.recipesList, "create"],
    mutationFn: async (body: CreateRecipePayload) => {
      return await fetchWithAuth<RecipeResponse>("/api/recipes", {
        method: "POST",
        body: JSON.stringify(body),
        headers: {
          "Content-Type": "application/json"
        }
      });
    },
    onSuccess: () => {
      // refresh any lists that show recipes
      queryClient.invalidateQueries({ queryKey: qk.recipesList });
    }
  });
}

export function useRateRecipeMutation() {
  const fetchWithAuth = useFetchWithAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: [...qk.recipesList, "rate"],
    mutationFn: async ({
      recipeId,
      rating
    }: {
      recipeId: number;
      rating: number;
    }) => {
      // Response shape kept loose so it still works
      // with your existing setRatingStats(res.rating)
      return await fetchWithAuth<{ rating: any }>(
        `/api/recipes/${recipeId}/ratings`,
        {
          method: "POST",
          body: JSON.stringify({ rating }),
          headers: {
            "Content-Type": "application/json"
          }
        }
      );
    },
    onSuccess: (_data, variables) => {
      // Make sure recipe details + lists stay fresh
      queryClient.invalidateQueries({
        queryKey: qk.recipe(String(variables.recipeId))
      });
      queryClient.invalidateQueries({ queryKey: qk.recipesList });
    }
  });
}

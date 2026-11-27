import {
  accountInfoResponseSchema,
  hydrometerAccountResponseSchema,
  hydrometerLogsResponseSchema,
  hydrometerLogResponseSchema,
  updateHydrometerLogRequestBodySchema,
  deleteHydrometerLogsInRangeResponseSchema,
  type HydrometerLogResponse,
  type UpdateHydrometerLogRequestBody,
  type HydrometerDeviceResponse,
  brewResponseSchema,
  brewInventoryContextResponseSchema,
  finishedMeadOverviewResponseSchema,
  inventoryOrganizationResponseSchema,
  brewsResponseSchema,
  createBrewEntryRequestBodySchema,
  createBrewRequestBodySchema,
  createBrewResponseSchema,
  createBrewEntryResponseSchema,
  deleteBrewEntryRequestBodySchema,
  deleteBrewEntrySuccessResponseSchema,
  deleteBrewSuccessResponseSchema,
  getRecipeResponseSchema,
  inventoryOverviewResponseSchema,
  ingredientsResponseSchema,
  nutrientPresetListResponseSchema,
  yeastsResponseSchema,
  updateBrewEntryRequestBodySchema,
  updateBrewRequestBodySchema,
  updateBrewResponseSchema,
  updateBrewEntryResponseSchema,
  loginRequestBodySchema,
  loginSuccessResponseSchema,
  recipeDataV2Schema,
  recipeDerivedStateResponseBodySchema,
  refreshTokenRequestBodySchema,
  refreshTokenSuccessResponseSchema,
  verifyTokenRequestBodySchema,
  verifyTokenSuccessResponseSchema,
  type AccountRecipeResponse,
  type BrewListItemResponse,
  type BrewResponse,
  type BrewInventoryContextResponse,
  type FinishedMeadOverviewResponse,
  type InventoryOrganizationResponse,
  type CreateBrewEntryRequestBody,
  type CreateBrewRequestBody,
  type CreateBrewResponse,
  type UpdateBrewRequestBody,
  type UpdateBrewResponse,
  type DeleteBrewEntryRequestBody,
  type DeleteBrewEntrySuccessResponse,
  type DeleteBrewSuccessResponse,
  type GetRecipeResponse,
  type InventoryOverviewResponse,
  type IngredientsResponse,
  type NutrientPresetListResponse,
  type YeastsResponse,
  type UpdateBrewEntryRequestBody,
  type UpdateBrewEntryResponse,
  type LoginRequestBody,
  type LoginSuccessResponse,
  type RecipeDataV2Input,
  type RecipeDerivedStateResponseBody,
  type RefreshTokenRequestBody,
  type RefreshTokenSuccessResponse,
  type VerifyTokenSuccessResponse
} from "@meadtools/api-contract";

export type ApiRequestInit = {
  method: string;
  headers: Record<string, string>;
  body?: string;
};

export type ApiResponse = {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
};

export type FetchTransport = (
  url: string,
  init: ApiRequestInit
) => Promise<ApiResponse>;

export type MeadToolsApiClientOptions = {
  baseUrl: string;
  fetch: FetchTransport;
  getAccessToken?: () =>
    | string
    | null
    | undefined
    | Promise<string | null | undefined>;
};

export class MeadToolsApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, body: unknown) {
    super(errorMessage(status, body));
    this.name = "MeadToolsApiError";
    this.status = status;
    this.body = body;
  }
}

export class MeadToolsContractError extends Error {
  readonly value: unknown;

  constructor(message: string, value: unknown) {
    super(message);
    this.name = "MeadToolsContractError";
    this.value = value;
  }
}

function errorMessage(status: number, body: unknown) {
  if (
    body &&
    typeof body === "object" &&
    "error" in body &&
    typeof body.error === "string"
  ) {
    return body.error;
  }

  return `MeadTools API request failed with status ${status}`;
}

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/+$/, "");
}

async function readJson(response: ApiResponse) {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

async function requestHeaders(options: MeadToolsApiClientOptions) {
  const headers: Record<string, string> = {
    accept: "application/json",
    "content-type": "application/json"
  };
  const accessToken = await options.getAccessToken?.();

  if (accessToken) {
    headers.authorization = `Bearer ${accessToken}`;
  }

  return headers;
}

function parseHydrometerResponse<T>(schema: { safeParse(value: unknown): { success: true; data: T } | { success: false } }, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new MeadToolsContractError("Hydrometer response does not match the MeadTools API contract", value);
  return parsed.data;
}

export function createMeadToolsApiClient(options: MeadToolsApiClientOptions) {
  const baseUrl = normalizeBaseUrl(options.baseUrl);

  async function request(path: string, init: Omit<ApiRequestInit, "headers">) {
    const response = await options.fetch(`${baseUrl}${path}`, {
      ...init,
      headers: await requestHeaders(options)
    });
    const body = await readJson(response);

    if (!response.ok) {
      throw new MeadToolsApiError(response.status, body);
    }

    return body;
  }

  return {
    /** Lists owned devices without retaining the account's setup token in caches. */
    async listHydrometerDevices(): Promise<HydrometerDeviceResponse[]> {
      const body = await request("/api/hydrometer", { method: "GET" });
      const parsed = hydrometerAccountResponseSchema.safeParse(body);
      if (!parsed.success) {
        // The response contains a setup token. Do not attach it to an error.
        throw new MeadToolsContractError(
          "Hydrometer response does not match the MeadTools API contract",
          undefined
        );
      }
      return parsed.data.devices;
    },

    async listHydrometerLogs(input: { deviceId: string; startDate: string; endDate: string }): Promise<HydrometerLogResponse[]> {
      const start = Date.parse(input.startDate);
      const end = Date.parse(input.endDate);
      if (!input.deviceId || !Number.isFinite(start) || !Number.isFinite(end) || start > end) {
        throw new MeadToolsContractError("Invalid hydrometer log range", undefined);
      }
      const query = new URLSearchParams({ device_id: input.deviceId, start_date: input.startDate, end_date: input.endDate });
      return parseHydrometerResponse(hydrometerLogsResponseSchema, await request(`/api/hydrometer/logs?${query}`, { method: "GET" }));
    },

    async listBrewHydrometerLogs(brewId: string): Promise<HydrometerLogResponse[]> {
      return parseHydrometerResponse(hydrometerLogsResponseSchema, await request(`/api/hydrometer/logs/${encodeURIComponent(brewId)}`, { method: "GET" }));
    },

    async updateHydrometerLog(logId: string, deviceId: string, input: UpdateHydrometerLogRequestBody): Promise<HydrometerLogResponse> {
      const parsed = updateHydrometerLogRequestBodySchema.safeParse(input);
      if (!parsed.success) throw new MeadToolsContractError("Invalid hydrometer log update", input);
      return parseHydrometerResponse(hydrometerLogResponseSchema, await request(`/api/hydrometer/logs/${encodeURIComponent(logId)}?device_id=${encodeURIComponent(deviceId)}`, { method: "PATCH", body: JSON.stringify(parsed.data) }));
    },

    async deleteHydrometerLog(logId: string, deviceId: string): Promise<HydrometerLogResponse> {
      return parseHydrometerResponse(hydrometerLogResponseSchema, await request(`/api/hydrometer/logs/${encodeURIComponent(logId)}?device_id=${encodeURIComponent(deviceId)}`, { method: "DELETE" }));
    },

    async deleteHydrometerLogsInRange(input: { deviceId: string; startDate: string; endDate: string }) {
      const start = Date.parse(input.startDate);
      const end = Date.parse(input.endDate);
      if (!input.deviceId || !Number.isFinite(start) || !Number.isFinite(end) || start > end) throw new MeadToolsContractError("Invalid hydrometer log range", undefined);
      const query = new URLSearchParams({ device_id: input.deviceId, start_date: input.startDate, end_date: input.endDate });
      return parseHydrometerResponse(deleteHydrometerLogsInRangeResponseSchema, await request(`/api/hydrometer/logs/range?${query}`, { method: "DELETE" }));
    },

    async login(input: LoginRequestBody): Promise<LoginSuccessResponse> {
      if (!loginRequestBodySchema.safeParse(input).success) {
        throw new MeadToolsContractError(
          "Login request does not match the MeadTools API contract",
          input
        );
      }

      const body = await request("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(input)
      });
      const parsed = loginSuccessResponseSchema.safeParse(body);
      if (!parsed.success) {
        throw new MeadToolsContractError(
          "Login response does not match the MeadTools API contract",
          body
        );
      }

      return parsed.data;
    },

    async signInWithGoogle(
      idToken: string
    ): Promise<VerifyTokenSuccessResponse> {
      const input = {
        token: idToken,
        provider: "google" as const
      };

      if (!verifyTokenRequestBodySchema.safeParse(input).success) {
        throw new MeadToolsContractError(
          "Google sign-in request does not match the MeadTools API contract",
          input
        );
      }

      const body = await request("/api/auth/verify-token", {
        method: "POST",
        body: JSON.stringify(input)
      });
      const parsed = verifyTokenSuccessResponseSchema.safeParse(body);
      if (!parsed.success) {
        throw new MeadToolsContractError(
          "Google sign-in response does not match the MeadTools API contract",
          body
        );
      }

      return parsed.data;
    },

    async refreshAccessToken(
      input: RefreshTokenRequestBody
    ): Promise<RefreshTokenSuccessResponse> {
      if (!refreshTokenRequestBodySchema.safeParse(input).success) {
        throw new MeadToolsContractError(
          "Refresh request does not match the MeadTools API contract",
          input
        );
      }

      const body = await request("/api/auth/refresh", {
        method: "POST",
        body: JSON.stringify(input)
      });
      const parsed = refreshTokenSuccessResponseSchema.safeParse(body);
      if (!parsed.success) {
        throw new MeadToolsContractError(
          "Refresh response does not match the MeadTools API contract",
          body
        );
      }

      return parsed.data;
    },

    async calculateRecipeDerived(
      recipeData: RecipeDataV2Input
    ): Promise<RecipeDerivedStateResponseBody> {
      if (!recipeDataV2Schema.safeParse(recipeData).success) {
        throw new MeadToolsContractError(
          "Recipe data does not match the MeadTools API contract",
          recipeData
        );
      }

      const body = await request("/api/recipes/derived", {
        method: "POST",
        body: JSON.stringify(recipeData)
      });
      const parsed = recipeDerivedStateResponseBodySchema.safeParse(body);
      if (!parsed.success) {
        throw new MeadToolsContractError(
          "Response does not match the MeadTools API contract",
          body
        );
      }

      return parsed.data;
    },

    async listRecipes(): Promise<AccountRecipeResponse[]> {
      const body = await request("/api/auth/account-info", {
        method: "GET"
      });
      const parsed = accountInfoResponseSchema.safeParse(body);
      if (!parsed.success) {
        throw new MeadToolsContractError(
          "Recipe list response does not match the MeadTools API contract",
          body
        );
      }

      return parsed.data.recipes;
    },

    async listBrews(): Promise<BrewListItemResponse[]> {
      const body = await request("/api/brews", { method: "GET" });
      const parsed = brewsResponseSchema.safeParse(body);
      if (!parsed.success) {
        throw new MeadToolsContractError(
          "Brew list response does not match the MeadTools API contract",
          body
        );
      }

      return parsed.data.brews;
    },

    /**
     * A recipe the account owns, or any public recipe, exactly as stored.
     * The response is validated against the contract, but its `dataV2` is
     * returned unparsed: the contract normalizes nutrient settings (numbers to
     * strings, defaults), and brew snapshots are compared against the stored
     * plan, so a normalized copy would always look changed.
     */
    async getRecipe(recipeId: number): Promise<RecipeSource> {
      const body = await request(`/api/recipes/${encodeURIComponent(String(recipeId))}`, {
        method: "GET"
      });
      const parsed = getRecipeResponseSchema.safeParse(body);
      if (!parsed.success) {
        throw new MeadToolsContractError(
          "Recipe response does not match the MeadTools API contract",
          body
        );
      }

      const stored = (body as { recipe: { dataV2: unknown } }).recipe.dataV2;
      return { ...parsed.data.recipe, dataV2: stored };
    },

    /** Permanently deletes an owned brew, its entries and its hydrometer logs. */
    async deleteBrew(brewId: string): Promise<DeleteBrewSuccessResponse> {
      const body = await request(`/api/brews/${encodeURIComponent(brewId)}`, {
        method: "DELETE"
      });
      const parsed = deleteBrewSuccessResponseSchema.safeParse(body);
      if (!parsed.success) {
        throw new MeadToolsContractError(
          "Brew delete response does not match the MeadTools API contract",
          body
        );
      }

      return parsed.data;
    },

    async getBrew(brewId: string): Promise<BrewResponse> {
      const body = await request(
        `/api/brews/${encodeURIComponent(brewId)}`,
        { method: "GET" }
      );
      const parsed = brewResponseSchema.safeParse(body);
      if (!parsed.success) {
        throw new MeadToolsContractError(
          "Brew response does not match the MeadTools API contract",
          body
        );
      }

      return parsed.data;
    },

    /** Starts a private brew from an owned or public recipe and snapshots it. */
    async createBrew(
      input: CreateBrewRequestBody
    ): Promise<CreateBrewResponse["brew"]> {
      if (!createBrewRequestBodySchema.safeParse(input).success) {
        throw new MeadToolsContractError(
          "Brew does not match the MeadTools API contract",
          input
        );
      }

      const body = await request("/api/brews", {
        method: "POST",
        body: JSON.stringify(input)
      });
      const parsed = createBrewResponseSchema.safeParse(body);
      if (!parsed.success) {
        throw new MeadToolsContractError(
          "Created brew response does not match the MeadTools API contract",
          body
        );
      }

      return parsed.data.brew;
    },

    /** Updates brew metadata such as the name, batch, start date, alerts or visibility. */
    async updateBrew(
      brewId: string,
      input: UpdateBrewRequestBody
    ): Promise<UpdateBrewResponse> {
      if (!updateBrewRequestBodySchema.safeParse(input).success) {
        throw new MeadToolsContractError(
          "Brew update does not match the MeadTools API contract",
          input
        );
      }

      const body = await request(`/api/brews/${encodeURIComponent(brewId)}`, {
        method: "PATCH",
        body: JSON.stringify(input)
      });
      const parsed = updateBrewResponseSchema.safeParse(body);
      if (!parsed.success) {
        throw new MeadToolsContractError(
          "Brew update response does not match the MeadTools API contract",
          body
        );
      }

      return parsed.data;
    },

    async createBrewEntry(
      brewId: string,
      input: CreateBrewEntryRequestBody
    ): Promise<BrewResponse> {
      if (!createBrewEntryRequestBodySchema.safeParse(input).success) {
        throw new MeadToolsContractError(
          "Brew entry does not match the MeadTools API contract",
          input
        );
      }

      const body = await request(
        `/api/brews/${encodeURIComponent(brewId)}/entries`,
        {
          method: "POST",
          body: JSON.stringify(input)
        }
      );
      const parsed = createBrewEntryResponseSchema.safeParse(body);
      if (!parsed.success) {
        throw new MeadToolsContractError(
          "Brew entry response does not match the MeadTools API contract",
          body
        );
      }

      return parsed.data.brew;
    },

    /** Owned, non-archived stock and whether the account can deduct from it. */
    async getInventoryOverview(): Promise<InventoryOverviewResponse> {
      const body = await request("/api/account/inventory", { method: "GET" });
      const parsed = inventoryOverviewResponseSchema.safeParse(body);
      if (!parsed.success) {
        throw new MeadToolsContractError(
          "Inventory response does not match the MeadTools API contract",
          body
        );
      }
      return parsed.data;
    },

    async getBrewInventory(brewId: string): Promise<BrewInventoryContextResponse> {
      const body = await request(`/api/brews/${encodeURIComponent(brewId)}/inventory`, { method: "GET" });
      const parsed = brewInventoryContextResponseSchema.safeParse(body);
      if (!parsed.success) throw new MeadToolsContractError("Brew inventory does not match the MeadTools API contract", body);
      return parsed.data;
    },

    async getFinishedMeads(): Promise<FinishedMeadOverviewResponse> {
      const body = await request("/api/account/inventory/meads", { method: "GET" });
      const parsed = finishedMeadOverviewResponseSchema.safeParse(body);
      if (!parsed.success) throw new MeadToolsContractError("Finished meads do not match the MeadTools API contract", body);
      return parsed.data;
    },

    async getInventoryOrganization(): Promise<InventoryOrganizationResponse> {
      const body = await request("/api/account/inventory/organization", { method: "GET" });
      const parsed = inventoryOrganizationResponseSchema.safeParse(body);
      if (!parsed.success) throw new MeadToolsContractError("Inventory organization does not match the MeadTools API contract", body);
      return parsed.data;
    },

    /** The public yeast catalog (no sign-in needed). */
    async listYeasts(): Promise<YeastsResponse> {
      const body = await request("/api/yeasts", { method: "GET" });
      const parsed = yeastsResponseSchema.safeParse(body);
      if (!parsed.success) throw new MeadToolsContractError("Yeast list does not match the MeadTools API contract", body);
      return parsed.data;
    },

    /** The public ingredient catalog (no sign-in needed). */
    async listIngredients(): Promise<IngredientsResponse> {
      const body = await request("/api/ingredients", { method: "GET" });
      const parsed = ingredientsResponseSchema.safeParse(body);
      if (!parsed.success) throw new MeadToolsContractError("Ingredient list does not match the MeadTools API contract", body);
      return parsed.data;
    },

    /** Curated presets for the nutrient calculator's Other nutrient (no sign-in needed). */
    async listNutrientPresets(): Promise<NutrientPresetListResponse> {
      const body = await request("/api/nutrient-presets", { method: "GET" });
      const parsed = nutrientPresetListResponseSchema.safeParse(body);
      if (!parsed.success) throw new MeadToolsContractError("Nutrient preset list does not match the MeadTools API contract", body);
      return parsed.data;
    },

    async updateBrewEntry(
      brewId: string,
      entryId: string,
      input: UpdateBrewEntryRequestBody
    ): Promise<UpdateBrewEntryResponse> {
      if (!updateBrewEntryRequestBodySchema.safeParse(input).success) {
        throw new MeadToolsContractError(
          "Brew entry update does not match the MeadTools API contract",
          input
        );
      }
      const body = await request(
        `/api/brews/${encodeURIComponent(brewId)}/entries/${encodeURIComponent(entryId)}`,
        { method: "PATCH", body: JSON.stringify(input) }
      );
      const parsed = updateBrewEntryResponseSchema.safeParse(body);
      if (!parsed.success) {
        throw new MeadToolsContractError(
          "Brew entry update response does not match the MeadTools API contract",
          body
        );
      }
      return parsed.data;
    },

    async deleteBrewEntry(
      brewId: string,
      entryId: string,
      input: DeleteBrewEntryRequestBody = {}
    ): Promise<DeleteBrewEntrySuccessResponse> {
      if (!deleteBrewEntryRequestBodySchema.safeParse(input).success) {
        throw new MeadToolsContractError(
          "Brew entry delete does not match the MeadTools API contract",
          input
        );
      }
      const body = await request(
        `/api/brews/${encodeURIComponent(brewId)}/entries/${encodeURIComponent(entryId)}`,
        { method: "DELETE", body: JSON.stringify(input) }
      );
      const parsed = deleteBrewEntrySuccessResponseSchema.safeParse(body);
      if (!parsed.success) {
        throw new MeadToolsContractError(
          "Brew entry delete response does not match the MeadTools API contract",
          body
        );
      }
      return parsed.data;
    }
  };
}

/** A recipe with its plan (`dataV2`) exactly as stored on the server. */
export type RecipeSource = Omit<GetRecipeResponse["recipe"], "dataV2"> & {
  dataV2: unknown;
};

export type MeadToolsApiClient = ReturnType<typeof createMeadToolsApiClient>;

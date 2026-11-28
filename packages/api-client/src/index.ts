import {
  brewImageAccessResponseSchema,
  coverImageResponseSchema
} from "@meadtools/api-contract/brew-images";
import {
  accountInfoResponseSchema,
  hydrometerAccountResponseSchema,
  hydrometerTokenResponseSchema,
  hydrometerDeviceResponseSchema,
  deleteHydrometerDeviceResponseSchema,
  hydrometerBrewsResponseSchema,
  hydrometerBrewResponseSchema,
  startHydrometerBrewRequestBodySchema,
  startHydrometerBrewResponseSchema,
  endHydrometerBrewResponseSchema,
  hydrometerBrewAlertResponseSchema,
  attachDeviceToBrewResponseSchema,
  adoptLogsForBrewResponseSchema,
  type HydrometerBrewResponse,
  hydrometerLogsResponseSchema,
  hydrometerLogResponseSchema,
  updateHydrometerLogRequestBodySchema,
  deleteHydrometerLogsInRangeResponseSchema,
  type HydrometerLogResponse,
  type UpdateHydrometerLogRequestBody,
  type HydrometerDeviceResponse,
  brewCostResponseSchema,
  inventoryCostExclusionsResponseSchema,
  inventoryCurrencyResponseSchema,
  recipeCostResponseSchema,
  updateBrewCostRequestBodySchema,
  updateInventoryCostExclusionsRequestBodySchema,
  updateInventoryCurrencyRequestBodySchema,
  createEquipmentRequestBodySchema,
  equipmentMutationResponseSchema,
  equipmentOverviewResponseSchema,
  updateEquipmentRequestBodySchema,
  createFinishedMeadRequestBodySchema,
  finishedMeadHistoryResponseSchema,
  finishedMeadMutationResponseSchema,
  inventoryOrganizationMutationResponseSchema,
  inventoryStorageHistoryResponseSchema,
  updateFinishedMeadRequestBodySchema,
  updateInventoryOrganizationRequestBodySchema,
  updateInventoryStorageRequestBodySchema,
  additivesResponseSchema,
  accountProfileResponseSchema,
  brewResponseSchema,
  brewInventoryContextResponseSchema,
  finishedMeadOverviewResponseSchema,
  inventoryOrganizationResponseSchema,
  brewsResponseSchema,
  createBrewEntryRequestBodySchema,
  createBrewRequestBodySchema,
  createBrewResponseSchema,
  createBrewEntryResponseSchema,
  createInventoryStockRequestBodySchema,
  creditBalanceResponseSchema,
  deleteBrewEntryRequestBodySchema,
  deleteBrewEntrySuccessResponseSchema,
  deleteBrewSuccessResponseSchema,
  getRecipeResponseSchema,
  recipePdfResponseSchema,
  type RecipePdfQueryParams,
  inventoryOverviewResponseSchema,
  inventoryStockHistoryResponseSchema,
  inventoryStockMutationResponseSchema,
  ingredientsResponseSchema,
  nutrientPresetListResponseSchema,
  premiumAccessResponseSchema,
  yeastsResponseSchema,
  updateBrewEntryRequestBodySchema,
  updateAccountProfileInputSchema,
  updateAccountProfileResultSchema,
  updateBrewRequestBodySchema,
  updateBrewResponseSchema,
  updateBrewEntryResponseSchema,
  updateInventoryStockRequestBodySchema,
  loginRequestBodySchema,
  loginSuccessResponseSchema,
  recipeDataV2Schema,
  recipeDerivedStateResponseBodySchema,
  refreshTokenRequestBodySchema,
  refreshTokenSuccessResponseSchema,
  releaseEmailPreferencesResponseSchema,
  releaseEmailPreferencesUpdateBodySchema,
  verifyTokenRequestBodySchema,
  verifyTokenSuccessResponseSchema,
  type AccountRecipeResponse,
  type BrewCostResponse,
  type InventoryCostExclusionsResponse,
  type InventoryCurrencyResponse,
  type RecipeCostResponse,
  type UpdateBrewCostRequestBody,
  type UpdateInventoryCostExclusionsRequestBody,
  type UpdateInventoryCurrencyRequestBody,
  type CreateEquipmentRequestBody,
  type EquipmentMutationResponse,
  type EquipmentOverviewResponse,
  type UpdateEquipmentRequestBody,
  type CreateFinishedMeadRequestBody,
  type FinishedMeadHistoryResponse,
  type FinishedMeadMutationResponse,
  type InventoryOrganizationMutationResponse,
  type InventoryStorageHistoryResponse,
  type UpdateFinishedMeadRequestBody,
  type UpdateInventoryOrganizationRequestBody,
  type UpdateInventoryStorageRequestBody,
  type AdditivesResponse,
  type AccountProfile,
  type UpdateAccountProfileInput,
  type UpdateAccountProfileResult,
  type BrewListItemResponse,
  type BrewResponse,
  type BrewInventoryContextResponse,
  type FinishedMeadOverviewResponse,
  type InventoryOrganizationResponse,
  type CreateBrewEntryRequestBody,
  type CreateBrewRequestBody,
  type CreateBrewResponse,
  type CreateInventoryStockRequestBody,
  type CreditBalanceResponse,
  type UpdateBrewRequestBody,
  type UpdateBrewResponse,
  type DeleteBrewEntryRequestBody,
  type DeleteBrewEntrySuccessResponse,
  type DeleteBrewSuccessResponse,
  type GetRecipeResponse,
  type InventoryOverviewResponse,
  type InventoryStockHistoryResponse,
  type InventoryStockMutationResponse,
  type IngredientsResponse,
  type NutrientPresetListResponse,
  type PremiumAccessResponse,
  type YeastsResponse,
  type UpdateBrewEntryRequestBody,
  type UpdateBrewEntryResponse,
  type UpdateInventoryStockRequestBody,
  type LoginRequestBody,
  type LoginSuccessResponse,
  type RecipeDataV2Input,
  type RecipeDerivedStateResponseBody,
  type RefreshTokenRequestBody,
  type RefreshTokenSuccessResponse,
  type ReleaseEmailPreferencesResponse,
  type ReleaseEmailPreferencesUpdateBody,
  type VerifyTokenSuccessResponse
} from "@meadtools/api-contract";

const premiumStatusFields = {
  entitled: true,
  membershipExpired: true,
  premiumEnabled: true,
  paidThrough: true,
  paymentRestricted: true
} as const;

const premiumStatusSchema = premiumAccessResponseSchema.pick(premiumStatusFields);
type PremiumStatus = Pick<PremiumAccessResponse, keyof typeof premiumStatusFields>;

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

  // Setup responses may contain a private device token. Keep response bodies out of errors.
  async function secretRequest(path: string, method: string) {
    try {
      return await request(path, { method });
    } catch (error) {
      if (error instanceof MeadToolsApiError) throw new MeadToolsApiError(error.status, undefined);
      throw new Error("Hydrometer setup request failed");
    }
  }

  function parseInventoryPayload<T>(
    schema: { safeParse(value: unknown): { success: true; data: T } | { success: false } },
    value: unknown,
    label: string
  ): T {
    const parsed = schema.safeParse(value);
    if (!parsed.success) throw new MeadToolsContractError(`${label} does not match the MeadTools API contract`, value);
    return parsed.data;
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

    /** Deliberate, uncached setup read. Call only after the user requests the token. */
    async getHydrometerSetupToken(): Promise<string | null> {
      const result = hydrometerAccountResponseSchema.safeParse(await secretRequest("/api/hydrometer", "GET"));
      if (!result.success) throw new MeadToolsContractError("Invalid hydrometer setup response", undefined);
      return result.data.hydro_token;
    },

    /** Replaces the existing token; callers must explain that devices need updating. */
    async generateHydrometerSetupToken(): Promise<string> {
      const result = hydrometerTokenResponseSchema.safeParse(await secretRequest("/api/hydrometer/token", "POST"));
      if (!result.success || !result.data.token) throw new MeadToolsContractError("Invalid hydrometer token response", undefined);
      return result.data.token;
    },

    async updateHydrometerCoefficients(deviceId: string, coefficients: readonly number[]) {
      if (!deviceId || coefficients.length !== 4 || !coefficients.every(Number.isFinite)) throw new MeadToolsContractError("Four finite calibration coefficients are required", undefined);
      return parseHydrometerResponse(hydrometerDeviceResponseSchema, await request(`/api/hydrometer/device/${encodeURIComponent(deviceId)}`, { method: "PATCH", body: JSON.stringify({ coefficients }) }));
    },

    async deleteHydrometerDevice(deviceId: string) {
      if (!deviceId) throw new MeadToolsContractError("A device is required", undefined);
      return parseHydrometerResponse(deleteHydrometerDeviceResponseSchema, await request(`/api/hydrometer/device/${encodeURIComponent(deviceId)}`, { method: "DELETE" }));
    },

    async listHydrometerBrews(): Promise<HydrometerBrewResponse[]> {
      return parseHydrometerResponse(hydrometerBrewsResponseSchema, await request("/api/hydrometer/brew", { method: "GET" }));
    },

    async startHydrometerBrew(deviceId: string, name: string): Promise<HydrometerBrewResponse> {
      const input = { device_id: deviceId, brew_name: name.trim() };
      if (!input.device_id || !input.brew_name || !startHydrometerBrewRequestBodySchema.safeParse(input).success) throw new MeadToolsContractError("A device and brew name are required", undefined);
      const pair = parseHydrometerResponse(startHydrometerBrewResponseSchema, await request("/api/hydrometer/brew", { method: "POST", body: JSON.stringify(input) }));
      const brew = pair.find((item): item is HydrometerBrewResponse => "start_date" in item);
      if (!brew) throw new MeadToolsContractError("Started brew missing from response", undefined);
      return brew;
    },

    async renameHydrometerBrew(brewId: string, name: string): Promise<HydrometerBrewResponse> {
      if (!brewId || !name.trim()) throw new MeadToolsContractError("A brew and non-empty name are required", undefined);
      return parseHydrometerResponse(hydrometerBrewResponseSchema, await request("/api/hydrometer/brew", { method: "PATCH", body: JSON.stringify({ brew_id: brewId, brew_name: name.trim() }) }));
    },

    async endHydrometerBrew(brewId: string, deviceId: string): Promise<HydrometerBrewResponse> {
      if (!brewId || !deviceId) throw new MeadToolsContractError("A brew and device are required", undefined);
      const pair = parseHydrometerResponse(endHydrometerBrewResponseSchema, await request("/api/hydrometer/brew", { method: "PATCH", body: JSON.stringify({ brew_id: brewId, device_id: deviceId }) }));
      const brew = pair.find((item): item is HydrometerBrewResponse => "start_date" in item);
      if (!brew) throw new MeadToolsContractError("Ended brew missing from response", undefined);
      return brew;
    },

    async unlinkHydrometerDevice(brewId: string, deviceId: string) {
      if (!brewId || !deviceId) throw new MeadToolsContractError("A brew and device are required", undefined);
      return parseHydrometerResponse(endHydrometerBrewResponseSchema, await request("/api/brews", { method: "PATCH", body: JSON.stringify({ brew_id: brewId, device_id: deviceId }) }));
    },

    async attachHydrometerDevice(brewId: string, deviceId: string) {
      if (!brewId || !deviceId) throw new MeadToolsContractError("A brew and device are required", undefined);
      return parseHydrometerResponse(attachDeviceToBrewResponseSchema, await request(`/api/brews/${encodeURIComponent(brewId)}/attach-device`, { method: "POST", body: JSON.stringify({ device_id: deviceId }) }));
    },

    async importUnassignedHydrometerLogs(brewId: string, deviceId: string) {
      if (!brewId || !deviceId) throw new MeadToolsContractError("A brew and device are required", undefined);
      return parseHydrometerResponse(adoptLogsForBrewResponseSchema, await request(`/api/brews/${encodeURIComponent(brewId)}/adopt-logs`, { method: "POST", body: JSON.stringify({ device_id: deviceId }) }));
    },

    async linkHydrometerBrewRecipe(brewId: string, recipeId: number): Promise<HydrometerBrewResponse> {
      if (!brewId || !Number.isSafeInteger(recipeId) || recipeId <= 0) throw new MeadToolsContractError("A brew and recipe are required", undefined);
      return parseHydrometerResponse(hydrometerBrewResponseSchema, await request(`/api/hydrometer/brew/${encodeURIComponent(brewId)}`, { method: "PATCH", body: JSON.stringify({ recipe_id: recipeId }) }));
    },

    async setHydrometerBrewAlerts(brewId: string, enabled: boolean) {
      if (!brewId) throw new MeadToolsContractError("A brew is required", undefined);
      return parseHydrometerResponse(hydrometerBrewAlertResponseSchema, await request(`/api/hydrometer/brew/${encodeURIComponent(brewId)}`, { method: "PATCH", body: JSON.stringify({ requested_email_alerts: enabled }) }));
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

    async getAccountProfile(): Promise<AccountProfile> {
      const body = await request("/api/auth/account-info", { method: "GET" });
      const parsed = accountProfileResponseSchema.safeParse(body);
      if (!parsed.success) {
        throw new MeadToolsContractError("Invalid account profile response", parsed.error.issues);
      }

      return parsed.data.user;
    },

    async updateAccountProfile(input: UpdateAccountProfileInput): Promise<UpdateAccountProfileResult> {
      const update = updateAccountProfileInputSchema.safeParse(input);
      if (!update.success) {
        throw new MeadToolsContractError("Invalid account profile update", update.error.issues);
      }

      const body = await request("/api/auth/account-info", {
        method: "PATCH",
        body: JSON.stringify(update.data)
      });
      const parsed = updateAccountProfileResultSchema.safeParse(body);
      if (!parsed.success) {
        throw new MeadToolsContractError("Invalid account profile update response", parsed.error.issues);
      }

      return parsed.data;
    },

    async getPremiumStatus(): Promise<PremiumStatus> {
      const body = await request("/api/account/premium", { method: "GET" });
      const parsed = premiumStatusSchema.safeParse(body);
      if (!parsed.success) {
        throw new MeadToolsContractError("Invalid Premium status response", parsed.error.issues);
      }

      return parsed.data;
    },

    async getCreditBalance(): Promise<CreditBalanceResponse> {
      const body = await request("/api/account/credits", { method: "GET" });
      const parsed = creditBalanceResponseSchema.safeParse(body);
      if (!parsed.success) {
        throw new MeadToolsContractError("Invalid credit balance response", parsed.error.issues);
      }

      return parsed.data;
    },

    async getReleaseEmailPreferences(): Promise<ReleaseEmailPreferencesResponse> {
      const body = await request("/api/account/release-emails", { method: "GET" });
      const parsed = releaseEmailPreferencesResponseSchema.safeParse(body);
      if (!parsed.success) {
        throw new MeadToolsContractError("Invalid release email preferences", parsed.error.issues);
      }
      return parsed.data;
    },

    async updateReleaseEmailPreferences(
      input: ReleaseEmailPreferencesUpdateBody
    ): Promise<ReleaseEmailPreferencesResponse> {
      const update = releaseEmailPreferencesUpdateBodySchema.safeParse(input);
      if (!update.success) {
        throw new MeadToolsContractError("Invalid release email preference update", update.error.issues);
      }
      const body = await request("/api/account/release-emails", {
        method: "PATCH",
        body: JSON.stringify(update.data)
      });
      const parsed = releaseEmailPreferencesResponseSchema.safeParse(body);
      if (!parsed.success) {
        throw new MeadToolsContractError("Invalid release email preferences", parsed.error.issues);
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

    async getRecipePdf(recipeId: number, locale: RecipePdfQueryParams["locale"]) {
      const id = encodeURIComponent(String(recipeId));
      const body = await request(`/api/recipes/${id}/pdf?locale=${encodeURIComponent(locale)}`, {
        method: "GET"
      });
      const parsed = recipePdfResponseSchema.safeParse(body);
      if (!parsed.success) {
        throw new MeadToolsContractError("Recipe PDF response does not match the MeadTools API contract", body);
      }
      return parsed.data;
    },

    async getRecipeCover(recipeId: number) {
      const body = await request(`/api/recipes/${encodeURIComponent(String(recipeId))}/cover`, {
        method: "GET"
      });
      const parsed = coverImageResponseSchema.safeParse(body);
      if (!parsed.success) {
        throw new MeadToolsContractError("Recipe cover response does not match the MeadTools API contract", body);
      }
      return parsed.data.image;
    },

    async getRecipeImageAccess(recipeId: number, imageId: string) {
      const id = encodeURIComponent(String(recipeId));
      const image = encodeURIComponent(imageId);
      const body = await request(`/api/recipes/${id}/images/${image}`, { method: "GET" });
      const parsed = brewImageAccessResponseSchema.safeParse(body);
      if (!parsed.success) {
        throw new MeadToolsContractError("Recipe image access response does not match the MeadTools API contract", body);
      }
      return parsed.data;
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

    async getInventoryStock(stockId: string): Promise<InventoryStockHistoryResponse> {
      const body = await request(
        `/api/account/inventory/${encodeURIComponent(stockId)}`,
        { method: "GET" }
      );
      const parsed = inventoryStockHistoryResponseSchema.safeParse(body);
      if (!parsed.success) {
        throw new MeadToolsContractError("Stock history does not match the MeadTools API contract", body);
      }
      return parsed.data;
    },

    async createInventoryStock(input: CreateInventoryStockRequestBody): Promise<InventoryStockMutationResponse> {
      const payload = createInventoryStockRequestBodySchema.safeParse(input);
      if (!payload.success) {
        throw new MeadToolsContractError("New stock does not match the MeadTools API contract", input);
      }
      const body = await request("/api/account/inventory", {
        method: "POST",
        body: JSON.stringify(payload.data)
      });
      const parsed = inventoryStockMutationResponseSchema.safeParse(body);
      if (!parsed.success) {
        throw new MeadToolsContractError("Stock creation response does not match the MeadTools API contract", body);
      }
      return parsed.data;
    },

    async updateInventoryStock(
      stockId: string,
      input: UpdateInventoryStockRequestBody
    ): Promise<InventoryStockMutationResponse> {
      const payload = updateInventoryStockRequestBodySchema.safeParse(input);
      if (!payload.success) {
        throw new MeadToolsContractError("Stock update does not match the MeadTools API contract", input);
      }
      const body = await request(
        `/api/account/inventory/${encodeURIComponent(stockId)}`,
        { method: "PATCH", body: JSON.stringify(payload.data) }
      );
      const parsed = inventoryStockMutationResponseSchema.safeParse(body);
      if (!parsed.success) {
        throw new MeadToolsContractError("Stock update response does not match the MeadTools API contract", body);
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

    async getFinishedMead(meadId: string): Promise<FinishedMeadHistoryResponse> {
      const body = await request(`/api/account/inventory/meads/${encodeURIComponent(meadId)}`, { method: "GET" });
      return parseInventoryPayload(finishedMeadHistoryResponseSchema, body, "Finished mead history");
    },

    async createFinishedMead(input: CreateFinishedMeadRequestBody): Promise<FinishedMeadMutationResponse> {
      const payload = parseInventoryPayload(createFinishedMeadRequestBodySchema, input, "New finished mead");
      const body = await request("/api/account/inventory/meads", { method: "POST", body: JSON.stringify(payload) });
      return parseInventoryPayload(finishedMeadMutationResponseSchema, body, "Finished mead creation response");
    },

    async updateFinishedMead(meadId: string, input: UpdateFinishedMeadRequestBody): Promise<FinishedMeadMutationResponse> {
      const payload = parseInventoryPayload(updateFinishedMeadRequestBodySchema, input, "Finished mead update");
      const body = await request(`/api/account/inventory/meads/${encodeURIComponent(meadId)}`, {
        method: "PATCH",
        body: JSON.stringify(payload)
      });
      return parseInventoryPayload(finishedMeadMutationResponseSchema, body, "Finished mead update response");
    },

    async updateInventoryOrganization(input: UpdateInventoryOrganizationRequestBody): Promise<InventoryOrganizationMutationResponse> {
      const payload = parseInventoryPayload(updateInventoryOrganizationRequestBodySchema, input, "Inventory organization update");
      const body = await request("/api/account/inventory/organization", { method: "PATCH", body: JSON.stringify(payload) });
      return parseInventoryPayload(inventoryOrganizationMutationResponseSchema, body, "Inventory organization update response");
    },

    async getInventoryStorageHistory(stockId: string): Promise<InventoryStorageHistoryResponse> {
      const body = await request(`/api/account/inventory/storage/${encodeURIComponent(stockId)}`, { method: "GET" });
      return parseInventoryPayload(inventoryStorageHistoryResponseSchema, body, "Storage history");
    },

    async updateInventoryStorage(stockId: string, input: UpdateInventoryStorageRequestBody): Promise<InventoryOrganizationMutationResponse> {
      const payload = parseInventoryPayload(updateInventoryStorageRequestBodySchema, input, "Inventory storage update");
      const body = await request(`/api/account/inventory/storage/${encodeURIComponent(stockId)}`, {
        method: "PATCH",
        body: JSON.stringify(payload)
      });
      return parseInventoryPayload(inventoryOrganizationMutationResponseSchema, body, "Inventory storage update response");
    },

    async updateInventoryCurrency(input: UpdateInventoryCurrencyRequestBody): Promise<InventoryCurrencyResponse> {
      const payload = parseInventoryPayload(updateInventoryCurrencyRequestBodySchema, input, "Inventory currency");
      const body = await request("/api/account/inventory/currency", { method: "PUT", body: JSON.stringify(payload) });
      return parseInventoryPayload(inventoryCurrencyResponseSchema, body, "Inventory currency response");
    },

    async getInventoryCostExclusions(): Promise<InventoryCostExclusionsResponse> {
      const body = await request("/api/account/inventory/cost-exclusions", { method: "GET" });
      return parseInventoryPayload(inventoryCostExclusionsResponseSchema, body, "Cost exclusions");
    },

    async updateInventoryCostExclusions(input: UpdateInventoryCostExclusionsRequestBody): Promise<InventoryCostExclusionsResponse> {
      const payload = parseInventoryPayload(updateInventoryCostExclusionsRequestBodySchema, input, "Cost exclusions update");
      const body = await request("/api/account/inventory/cost-exclusions", { method: "PATCH", body: JSON.stringify(payload) });
      return parseInventoryPayload(inventoryCostExclusionsResponseSchema, body, "Cost exclusions response");
    },

    async getBrewCosts(brewId: string): Promise<BrewCostResponse> {
      const body = await request(`/api/brews/${encodeURIComponent(brewId)}/costs`, { method: "GET" });
      return parseInventoryPayload(brewCostResponseSchema, body, "Brew costs");
    },

    async updateBrewCosts(brewId: string, input: UpdateBrewCostRequestBody): Promise<BrewCostResponse> {
      const payload = parseInventoryPayload(updateBrewCostRequestBodySchema, input, "Brew costs update");
      const body = await request(`/api/brews/${encodeURIComponent(brewId)}/costs`, { method: "POST", body: JSON.stringify(payload) });
      return parseInventoryPayload(brewCostResponseSchema, body, "Brew costs response");
    },

    async getRecipeCosts(recipeId: number): Promise<RecipeCostResponse> {
      const body = await request(`/api/recipes/${encodeURIComponent(recipeId)}/costs`, { method: "GET" });
      return parseInventoryPayload(recipeCostResponseSchema, body, "Recipe cost estimate");
    },

    async getEquipment(): Promise<EquipmentOverviewResponse> {
      const body = await request("/api/account/equipment", { method: "GET" });
      return parseInventoryPayload(equipmentOverviewResponseSchema, body, "Equipment overview");
    },

    async createEquipment(input: CreateEquipmentRequestBody): Promise<EquipmentMutationResponse> {
      const payload = parseInventoryPayload(createEquipmentRequestBodySchema, input, "New equipment");
      const body = await request("/api/account/equipment", { method: "POST", body: JSON.stringify(payload) });
      return parseInventoryPayload(equipmentMutationResponseSchema, body, "Equipment creation response");
    },

    async updateEquipment(id: string, input: UpdateEquipmentRequestBody): Promise<EquipmentMutationResponse> {
      const payload = parseInventoryPayload(updateEquipmentRequestBodySchema, input, "Equipment update");
      const body = await request(`/api/account/equipment/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify(payload)
      });
      return parseInventoryPayload(equipmentMutationResponseSchema, body, "Equipment update response");
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

    /** The public additive catalog (no sign-in needed). */
    async listAdditives(): Promise<AdditivesResponse> {
      const body = await request("/api/additives", { method: "GET" });
      const parsed = additivesResponseSchema.safeParse(body);
      if (!parsed.success) {
        throw new MeadToolsContractError("Additive list does not match the MeadTools API contract", body);
      }
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

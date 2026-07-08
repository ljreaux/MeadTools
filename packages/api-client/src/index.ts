import {
  accountInfoResponseSchema,
  brewResponseSchema,
  brewsResponseSchema,
  createBrewEntryRequestBodySchema,
  createBrewEntryResponseSchema,
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
  type CreateBrewEntryRequestBody,
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
    }
  };
}

export type MeadToolsApiClient = ReturnType<typeof createMeadToolsApiClient>;

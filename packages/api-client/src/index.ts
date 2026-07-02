import {
  recipeDataV2Schema,
  recipeDerivedStateResponseBodySchema,
  type RecipeDataV2Input,
  type RecipeDerivedStateResponseBody
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

  return {
    async calculateRecipeDerived(
      recipeData: RecipeDataV2Input
    ): Promise<RecipeDerivedStateResponseBody> {
      if (!recipeDataV2Schema.safeParse(recipeData).success) {
        throw new MeadToolsContractError(
          "Recipe data does not match the MeadTools API contract",
          recipeData
        );
      }

      const response = await options.fetch(`${baseUrl}/api/recipes/derived`, {
        method: "POST",
        headers: await requestHeaders(options),
        body: JSON.stringify(recipeData)
      });
      const body = await readJson(response);

      if (!response.ok) {
        throw new MeadToolsApiError(response.status, body);
      }

      if (!recipeDerivedStateResponseBodySchema.safeParse(body).success) {
        throw new MeadToolsContractError(
          "Response does not match the MeadTools API contract",
          body
        );
      }

      return body as RecipeDerivedStateResponseBody;
    }
  };
}

export type MeadToolsApiClient = ReturnType<typeof createMeadToolsApiClient>;

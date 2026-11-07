import { NextRequest, NextResponse } from "next/server";
import {
  recipeImagesPathParamsSchema,
  brewImagesQueryParamsSchema,
  createRecipeImageRequestBodySchema,
} from "@meadtools/api-contract/brew-images";
import {
  createBrewImageService,
  brewImageCacheHeaders,
} from "@/lib/db/brew-images";
import { verifyUser } from "@/lib/userAccessFunctions";
import {
  imageViewer,
  imageRouteError,
  readImageJson,
} from "@/lib/brews/imageRoute";
export const runtime = "nodejs";
export const maxDuration = 60;
const images = createBrewImageService({ target: "recipe" });
type Context = { params: Promise<{ id: string }> };
/**
 * List recipe photos
 * @description Lists owned photos, or publicly visible photos with public=true. Public reads require an active owner, a public recipe. Expired owners retain read access. No storage keys are exposed.
 * @pathParams RecipeImagesPathParams
 * @queryParams BrewImagesQueryParams
 * @response 200:BrewImagesResponse
 * @responseSet none
 * @add 400:BrewImageErrorResponse
 * @add 401:AuthenticatedRouteErrorResponse
 * @add 404:BrewImageErrorResponse
 * @add 500:BrewImageErrorResponse
 * @tag Recipe images
 * @openapi
 */
export async function GET(req: NextRequest, ctx: Context) {
  const user = await imageViewer(req);
  if (user instanceof NextResponse) return user;
  try {
    const { id } = recipeImagesPathParamsSchema.parse(await ctx.params);
    brewImagesQueryParamsSchema.parse(
      Object.fromEntries(req.nextUrl.searchParams),
    );
    return NextResponse.json(await images.list(id, user), {
      headers: brewImageCacheHeaders,
    });
  } catch (error) {
    return imageRouteError(error);
  }
}
/**
 * Upload a recipe photo
 * @description Premium owner upload of bounded base64 JPEG, PNG or WebP. The server validates actual content, normalizes orientation, strips metadata and stores a WebP display image and thumbnail. A successful new upload becomes the recipe cover atomically; earlier photos are retained. Stable operation IDs make retries idempotent without changing a later cover selection. Quotas include concurrent reservations and pending cleanup. Photos share the recipe's public visibility.
 * @pathParams RecipeImagesPathParams
 * @body CreateRecipeImageRequestBody
 * @response 201:BrewImageMutationResponse
 * @responseSet none
 * @add 400:BrewImageErrorResponse
 * @add 401:AuthenticatedRouteErrorResponse
 * @add 403:BrewImageErrorResponse
 * @add 404:BrewImageErrorResponse
 * @add 409:BrewImageErrorResponse
 * @add 413:BrewImageErrorResponse
 * @add 429:BrewImageErrorResponse
 * @add 500:BrewImageErrorResponse
 * @add 503:BrewImageErrorResponse
 * @auth BearerAuth
 * @tag Recipe images
 * @openapi
 */
export async function POST(req: NextRequest, ctx: Context) {
  const user = await verifyUser(req);
  if (user instanceof NextResponse) return user;
  try {
    const { id } = recipeImagesPathParamsSchema.parse(await ctx.params);
    const body = createRecipeImageRequestBodySchema.parse(
      await readImageJson(req),
    );
    return NextResponse.json(await images.upload(user, id, body), {
      status: 201,
      headers: brewImageCacheHeaders,
    });
  } catch (error) {
    return imageRouteError(error);
  }
}

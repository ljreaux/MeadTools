import { NextRequest, NextResponse } from "next/server";
import {
  brewImagesPathParamsSchema,
  brewImagesQueryParamsSchema,
  createBrewImageRequestBodySchema,
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
const images = createBrewImageService();
type Context = { params: Promise<{ brew_id: string }> };
/**
 * List brew photos
 * @description Lists owned photos, or publicly visible photos with public=true. Public reads require an active owner, a public brew and a public linked recipe. Expired owners retain read access. No storage keys are exposed.
 * @pathParams BrewImagesPathParams
 * @queryParams BrewImagesQueryParams
 * @response 200:BrewImagesResponse
 * @responseSet none
 * @add 400:BrewImageErrorResponse
 * @add 401:AuthenticatedRouteErrorResponse
 * @add 404:BrewImageErrorResponse
 * @add 500:BrewImageErrorResponse
 * @tag Brew images
 * @openapi
 */
export async function GET(req: NextRequest, ctx: Context) {
  const user = await imageViewer(req);
  if (user instanceof NextResponse) return user;
  try {
    const { brew_id } = brewImagesPathParamsSchema.parse(await ctx.params);
    brewImagesQueryParamsSchema.parse(
      Object.fromEntries(req.nextUrl.searchParams),
    );
    return NextResponse.json(await images.list(brew_id, user), {
      headers: brewImageCacheHeaders,
    });
  } catch (error) {
    return imageRouteError(error);
  }
}
/**
 * Upload a brew photo
 * @description Premium owner upload of bounded base64 JPEG, PNG or WebP. The server validates actual content, normalizes orientation, strips metadata and stores a WebP display image and thumbnail. Stable operation IDs make retries idempotent. Quotas include concurrent reservations and pending cleanup. Photos share the brew's public visibility.
 * @pathParams BrewImagesPathParams
 * @body CreateBrewImageRequestBody
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
 * @tag Brew images
 * @openapi
 */
export async function POST(req: NextRequest, ctx: Context) {
  const user = await verifyUser(req);
  if (user instanceof NextResponse) return user;
  try {
    const { brew_id } = brewImagesPathParamsSchema.parse(await ctx.params);
    const body = createBrewImageRequestBodySchema.parse(
      await readImageJson(req),
    );
    return NextResponse.json(await images.upload(user, brew_id, body), {
      status: 201,
      headers: brewImageCacheHeaders,
    });
  } catch (error) {
    return imageRouteError(error);
  }
}

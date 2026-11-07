import { NextRequest, NextResponse } from "next/server";
import {
  brewImagesPathParamsSchema,
  brewImagesQueryParamsSchema,
  setCoverImageRequestBodySchema,
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
const images = createBrewImageService();
type Context = { params: Promise<{ brew_id: string }> };
/**
 * Read the cover image
 * @description Returns the selected ready image, or null. Public reads require current public visibility and an active owner; brew covers also require a public linked recipe. No premium or sign-in is required with public=true. URLs are obtained from the image access endpoint.
 * @pathParams BrewImagesPathParams
 * @queryParams BrewImagesQueryParams
 * @response 200:CoverImageResponse
 * @responseSet none
 * @add 400:BrewImageErrorResponse
 * @add 401:AuthenticatedRouteErrorResponse
 * @add 404:BrewImageErrorResponse
 * @add 500:BrewImageErrorResponse
 * @tag Cover images
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
    return NextResponse.json(await images.cover(brew_id, user), {
      headers: brewImageCacheHeaders,
    });
  } catch (error) {
    return imageRouteError(error);
  }
}
/**
 * Choose or remove a cover image
 * @description Premium owners may select a ready photo belonging to this record. Owners may remove the selection after premium expiry. Removing a cover preserves its photo; deleting the photo clears its cover. Copying a recipe or starting a brew does not inherit its cover.
 * @pathParams BrewImagesPathParams
 * @body SetCoverImageRequestBody
 * @response 200:CoverImageResponse
 * @responseSet none
 * @add 400:BrewImageErrorResponse
 * @add 401:AuthenticatedRouteErrorResponse
 * @add 403:BrewImageErrorResponse
 * @add 404:BrewImageErrorResponse
 * @add 500:BrewImageErrorResponse
 * @auth BearerAuth
 * @tag Cover images
 * @openapi
 */
export async function PATCH(req: NextRequest, ctx: Context) {
  const user = await verifyUser(req);
  if (user instanceof NextResponse) return user;
  try {
    const { brew_id } = brewImagesPathParamsSchema.parse(await ctx.params);
    const { image_id } = setCoverImageRequestBodySchema.parse(
      await readImageJson(req),
    );
    return NextResponse.json(await images.setCover(user, brew_id, image_id), {
      headers: brewImageCacheHeaders,
    });
  } catch (error) {
    return imageRouteError(error);
  }
}

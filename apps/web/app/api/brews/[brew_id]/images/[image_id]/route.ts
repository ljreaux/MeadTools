import { NextRequest, NextResponse } from "next/server";
import {
  brewImagePathParamsSchema,
  brewImageAccessQueryParamsSchema,
  updateBrewImageRequestBodySchema,
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
type Context = { params: Promise<{ brew_id: string; image_id: string }> };
/**
 * Get temporary photo access
 * @description Authorizes each request before returning a private R2 URL valid for 60 seconds. public=true requires current public brew and recipe visibility and an active owner. Previously issued URLs may remain usable until expiry. Use variant=thumbnail for the gallery. Do not persist or publicly cache URLs.
 * @pathParams BrewImagePathParams
 * @queryParams BrewImageAccessQueryParams
 * @response 200:BrewImageAccessResponse
 * @responseSet none
 * @add 400:BrewImageErrorResponse
 * @add 401:AuthenticatedRouteErrorResponse
 * @add 404:BrewImageErrorResponse
 * @add 500:BrewImageErrorResponse
 * @add 503:BrewImageErrorResponse
 * @tag Brew images
 * @openapi
 */
export async function GET(req: NextRequest, ctx: Context) {
  const user = await imageViewer(req);
  if (user instanceof NextResponse) return user;
  try {
    const { brew_id, image_id } = brewImagePathParamsSchema.parse(
      await ctx.params,
    );
    const { variant } = brewImageAccessQueryParamsSchema.parse(
      Object.fromEntries(req.nextUrl.searchParams),
    );
    return NextResponse.json(
      await images.signedRead(brew_id, image_id, variant, user),
      { headers: brewImageCacheHeaders },
    );
  } catch (error) {
    return imageRouteError(error);
  }
}
/**
 * Caption a brew photo
 * @description Active owners may edit retained captions after premium expires. Changes are visible wherever the brew's photos are shared.
 * @pathParams BrewImagePathParams
 * @body UpdateBrewImageRequestBody
 * @response 200:BrewImageMutationResponse
 * @responseSet none
 * @add 400:BrewImageErrorResponse
 * @add 401:AuthenticatedRouteErrorResponse
 * @add 404:BrewImageErrorResponse
 * @add 500:BrewImageErrorResponse
 * @auth BearerAuth
 * @tag Brew images
 * @openapi
 */
export async function PATCH(req: NextRequest, ctx: Context) {
  const user = await verifyUser(req);
  if (user instanceof NextResponse) return user;
  try {
    const { brew_id, image_id } = brewImagePathParamsSchema.parse(
      await ctx.params,
    );
    const { caption } = updateBrewImageRequestBodySchema.parse(
      await readImageJson(req),
    );
    return NextResponse.json(
      await images.update(user, brew_id, image_id, caption),
      { headers: brewImageCacheHeaders },
    );
  } catch (error) {
    return imageRouteError(error);
  }
}
/**
 * Remove a brew photo
 * @description Active owners may remove retained photos after premium expires. Removal hides the record immediately and queues durable object cleanup. Pending deletion continues to count against storage until physical deletion succeeds. Repeating removal is safe.
 * @pathParams BrewImagePathParams
 * @response 200:BrewImageRemovedResponse
 * @responseSet none
 * @add 400:BrewImageErrorResponse
 * @add 401:AuthenticatedRouteErrorResponse
 * @add 404:BrewImageErrorResponse
 * @add 500:BrewImageErrorResponse
 * @auth BearerAuth
 * @tag Brew images
 * @openapi
 */
export async function DELETE(req: NextRequest, ctx: Context) {
  const user = await verifyUser(req);
  if (user instanceof NextResponse) return user;
  try {
    const { brew_id, image_id } = brewImagePathParamsSchema.parse(
      await ctx.params,
    );
    return NextResponse.json(await images.remove(user, brew_id, image_id), {
      headers: brewImageCacheHeaders,
    });
  } catch (error) {
    return imageRouteError(error);
  }
}

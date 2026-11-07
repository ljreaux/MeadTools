import { NextRequest, NextResponse } from "next/server";
import {
  recipeImagePathParamsSchema,
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
const images = createBrewImageService({ target: "recipe" });
type Context = { params: Promise<{ id: string; image_id: string }> };
/**
 * Get temporary photo access
 * @description Authorizes each request before returning a private R2 URL valid for 60 seconds. public=true requires current public recipe visibility and an active owner. Previously issued URLs may remain usable until expiry. Use variant=thumbnail for the gallery. Do not persist or publicly cache URLs.
 * @pathParams RecipeImagePathParams
 * @queryParams BrewImageAccessQueryParams
 * @response 200:BrewImageAccessResponse
 * @responseSet none
 * @add 400:BrewImageErrorResponse
 * @add 401:AuthenticatedRouteErrorResponse
 * @add 404:BrewImageErrorResponse
 * @add 500:BrewImageErrorResponse
 * @add 503:BrewImageErrorResponse
 * @tag Recipe images
 * @openapi
 */
export async function GET(req: NextRequest, ctx: Context) {
  const user = await imageViewer(req);
  if (user instanceof NextResponse) return user;
  try {
    const { id, image_id } = recipeImagePathParamsSchema.parse(
      await ctx.params,
    );
    const { variant } = brewImageAccessQueryParamsSchema.parse(
      Object.fromEntries(req.nextUrl.searchParams),
    );
    return NextResponse.json(
      await images.signedRead(id, image_id, variant, user),
      { headers: brewImageCacheHeaders },
    );
  } catch (error) {
    return imageRouteError(error);
  }
}
/**
 * Caption a recipe photo
 * @description Active owners may edit retained captions after premium expires. Changes are visible wherever the recipe's photos are shared.
 * @pathParams RecipeImagePathParams
 * @body UpdateBrewImageRequestBody
 * @response 200:BrewImageMutationResponse
 * @responseSet none
 * @add 400:BrewImageErrorResponse
 * @add 401:AuthenticatedRouteErrorResponse
 * @add 404:BrewImageErrorResponse
 * @add 500:BrewImageErrorResponse
 * @auth BearerAuth
 * @tag Recipe images
 * @openapi
 */
export async function PATCH(req: NextRequest, ctx: Context) {
  const user = await verifyUser(req);
  if (user instanceof NextResponse) return user;
  try {
    const { id, image_id } = recipeImagePathParamsSchema.parse(
      await ctx.params,
    );
    const { caption } = updateBrewImageRequestBodySchema.parse(
      await readImageJson(req),
    );
    return NextResponse.json(await images.update(user, id, image_id, caption), {
      headers: brewImageCacheHeaders,
    });
  } catch (error) {
    return imageRouteError(error);
  }
}
/**
 * Remove a recipe photo
 * @description Active owners may remove retained photos after premium expires. Removal hides the record immediately and queues durable object cleanup. Pending deletion continues to count against storage until physical deletion succeeds. Repeating removal is safe.
 * @pathParams RecipeImagePathParams
 * @response 200:BrewImageRemovedResponse
 * @responseSet none
 * @add 400:BrewImageErrorResponse
 * @add 401:AuthenticatedRouteErrorResponse
 * @add 404:BrewImageErrorResponse
 * @add 500:BrewImageErrorResponse
 * @auth BearerAuth
 * @tag Recipe images
 * @openapi
 */
export async function DELETE(req: NextRequest, ctx: Context) {
  const user = await verifyUser(req);
  if (user instanceof NextResponse) return user;
  try {
    const { id, image_id } = recipeImagePathParamsSchema.parse(
      await ctx.params,
    );
    return NextResponse.json(await images.remove(user, id, image_id), {
      headers: brewImageCacheHeaders,
    });
  } catch (error) {
    return imageRouteError(error);
  }
}

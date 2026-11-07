import "server-only";
import { createHash, randomUUID } from "node:crypto";
import type { Prisma, PrismaClient, brew_images } from "@prisma/client";
import {
  BREW_IMAGE_LIMITS as limits,
  BrewImageError,
  canReadBrewImage,
  canReadRecipeImage,
  checkBrewImageAllowance,
  projectBrewImage,
} from "@meadtools/brew-domain/images";
import type { CreateBrewImageRequestBody } from "@meadtools/api-contract/contracts";
import prisma from "@/lib/prisma";
import { getPremiumAccessStatus } from "./premium-access";
import { normalizeBrewImage } from "@/lib/brews/imageProcessing";
import {
  brewImageStorageEnvironment,
  createR2ImageStorage,
  isBrewImageStorageConfigured,
  type BrewImageStorage,
} from "@/lib/brews/imageStorage";

type Tx = Prisma.TransactionClient;
const charged = ["pending", "ready", "deleting"];
const hidden = ["pending", "ready"];
const entryInclude = {
  entry: { select: { id: true, title: true, datetime: true, data: true } },
} as const;
const readableImages = {
  OR: [{ original_entry_id: null }, { entry_id: { not: null } }],
};
const cacheHeaders = { "Cache-Control": "private, no-store" };
export { cacheHeaders as brewImageCacheHeaders };

/** Lock order matches inventory: account first, then brew. All quota changes use it. */
async function lockAccount(tx: Tx, userId: number) {
  const rows = await tx.$queryRaw<
    Array<{ id: number }>
  >`SELECT id FROM users WHERE id = ${userId} AND active = true FOR NO KEY UPDATE`;
  if (!rows.length) throw new BrewImageError("NOT_FOUND");
}
async function ownedBrew(tx: Tx, userId: number, brewId: string) {
  const rows = await tx.$queryRaw<
    Array<{ id: string }>
  >`SELECT id FROM brews WHERE id = ${brewId}::uuid AND user_id = ${userId} FOR UPDATE`;
  if (!rows.length) throw new BrewImageError("NOT_FOUND");
}

/** Called inside the parent deletion transaction, before losing its object identities. */
export async function queueBrewImageRemoval(
  tx: Tx,
  where: Prisma.brew_imagesWhereInput,
) {
  // A cover must always reference a live image, so list cover_image_id hints stay truthful.
  const doomed = await tx.brew_images.findMany({
    where: { ...where, status: { in: hidden } },
    select: { id: true },
  });
  const ids = doomed.map((image) => image.id);
  if (ids.length) {
    await tx.brews.updateMany({
      where: { cover_image_id: { in: ids } },
      data: { cover_image_id: null },
    });
    await tx.recipes.updateMany({
      where: { cover_image_id: { in: ids } },
      data: { cover_image_id: null },
    });
  }
  await tx.brew_images.updateMany({
    where: { ...where, status: { in: hidden } },
    data: {
      status: "deleting",
      removed: true,
      // Never delete while an in-flight handler may still be writing its objects.
      cleanup_after: new Date(Date.now() + 10 * 60_000),
    },
  });
}

export function createBrewImageService(
  options: {
    target?: "brew" | "recipe";
    database?: PrismaClient;
    storage?: () => BrewImageStorage;
    configured?: () => boolean;
    normalize?: typeof normalizeBrewImage;
  } = {},
) {
  const recipeTarget = options.target === "recipe";
  const parentWhere = (id: string) =>
    recipeTarget ? { recipe_id: Number(id) } : { brew_id: id };
  const originalWhere = (id: string) =>
    recipeTarget
      ? { original_recipe_id: Number(id) }
      : { original_brew_id: id };
  async function ownedParent(tx: Tx, userId: number, id: string) {
    if (!recipeTarget) return ownedBrew(tx, userId, id);
    const rows = await tx.$queryRaw<
      Array<{ id: number }>
    >`SELECT id FROM recipes WHERE id = ${Number(id)} AND user_id = ${userId} FOR UPDATE`;
    if (!rows.length) throw new BrewImageError("NOT_FOUND");
  }
  const db = options.database ?? prisma;
  const storage = options.storage ?? createR2ImageStorage;
  const configured = options.configured ?? isBrewImageStorageConfigured;
  const normalize = options.normalize ?? normalizeBrewImage;

  async function access(brewId: string, userId?: number) {
    if (recipeTarget) {
      const recipe = await db.recipes.findUnique({
        where: { id: Number(brewId) },
        select: {
          user_id: true,
          private: true,
          cover_image_id: true,
          users: { select: { active: true } },
        },
      });
      if (
        !recipe ||
        !canReadRecipeImage({
          activeOwner: Boolean(recipe.users?.active),
          ownsRecipe: recipe.user_id === userId,
          recipePublic: recipe.private === false,
        })
      )
        throw new BrewImageError("NOT_FOUND");
      return recipe;
    }
    const brew = await db.brews.findUnique({
      where: { id: brewId },
      select: {
        user_id: true,
        cover_image_id: true,
        public: true,
        recipes: { select: { private: true } },
        users: { select: { active: true } },
      },
    });
    if (
      !brew ||
      !canReadBrewImage({
        activeOwner: Boolean(brew.users?.active),
        ownsBrew: brew.user_id === userId,
        brewPublic: brew.public,
        recipePublic: brew.recipes?.private === false,
      })
    )
      throw new BrewImageError("NOT_FOUND");
    return brew;
  }

  async function list(brewId: string, userId?: number) {
    const brew = await access(brewId, userId);
    const images = await db.brew_images.findMany({
      where: {
        ...parentWhere(brewId),
        status: "ready",
        removed: false,
        ...readableImages,
      },
      include: entryInclude,
      orderBy: [{ created_at: "asc" }, { id: "asc" }],
    });
    if (userId === undefined || userId !== brew.user_id)
      return {
        images: images.map(projectBrewImage),
        can_upload: false,
        used_bytes: 0,
        allowance_bytes: limits.accountBytes,
      };
    const status = await getPremiumAccessStatus(userId, new Date(), db);
    const usage = await db.brew_images.aggregate({
      where: { user_id: userId, status: { in: charged } },
      _sum: { reserved_bytes: true },
    });
    return {
      images: images.map(projectBrewImage),
      can_upload: status.premiumEnabled && configured(),
      used_bytes: usage._sum.reserved_bytes ?? 0,
      allowance_bytes: limits.accountBytes,
    };
  }

  async function upload(
    userId: number,
    brewId: string,
    input: CreateBrewImageRequestBody,
  ) {
    // Fail before reserving quota if configuration is unavailable.
    const store = storage();
    const bytes = Buffer.from(input.base64, "base64");
    if (!bytes.length || bytes.length > limits.uploadBytes)
      throw new BrewImageError("IMAGE_TOO_LARGE");
    const hash = createHash("sha256")
      .update(
        JSON.stringify({
          brewId,
          ...(recipeTarget ? { target: "recipe" } : {}),
          ...(input.set_as_cover ? { setAsCover: true } : {}),
          entryId: input.entry_id ?? null,
          contentType: input.content_type,
          caption: input.caption,
        }),
      )
      .update(bytes)
      .digest("hex");
    const reservation = await db.$transaction(async (tx) => {
      await lockAccount(tx, userId);
      await ownedParent(tx, userId, brewId);
      const status = await getPremiumAccessStatus(userId, new Date(), tx);
      if (!status.premiumEnabled) throw new BrewImageError("PREMIUM_REQUIRED");
      const previous = await tx.brew_images.findUnique({
        where: { id: input.operation_id },
        include: entryInclude,
      });
      if (previous) {
        if (
          previous.user_id !== userId ||
          (recipeTarget
            ? previous.original_recipe_id !== Number(brewId)
            : previous.original_brew_id !== brewId) ||
          previous.request_hash !== hash ||
          previous.removed ||
          (previous.status === "ready" &&
            previous.original_entry_id !== null &&
            previous.entry_id === null)
        )
          throw new BrewImageError("OPERATION_CONFLICT");
        if (previous.status === "ready")
          return { replay: true, image: previous };
        if (previous.status !== "failed")
          throw new BrewImageError("UPLOAD_IN_PROGRESS");
      }
      if (recipeTarget && input.entry_id)
        throw new BrewImageError("INVALID_IMAGE");
      if (input.entry_id) {
        const entry = await tx.brew_entries.findFirst({
          where: { id: input.entry_id, brew_id: brewId },
          select: { id: true, data: true },
        });
        if (!entry || (entry.data as { hidden?: boolean } | null)?.hidden)
          throw new BrewImageError("NOT_FOUND");
      }
      const rows = await tx.brew_images.findMany({
        where: { user_id: userId },
        select: {
          status: true,
          reserved_bytes: true,
          brew_id: true,
          recipe_id: true,
          attempts: true,
          created_at: true,
          updated_at: true,
        },
      });
      const reserved = checkBrewImageAllowance({
        usedBytes: rows
          .filter((r) => charged.includes(r.status))
          .reduce((n, r) => n + r.reserved_bytes, 0),
        brewCount: rows.filter(
          (r) =>
            (recipeTarget
              ? r.recipe_id === Number(brewId)
              : r.brew_id === brewId) && charged.includes(r.status),
        ).length,
        pendingCount: rows.filter((r) => r.status === "pending").length,
        // Conservatively count all attempts on any record touched in the last day.
        dailyAttempts: rows
          .filter((r) => r.updated_at.getTime() > Date.now() - 86_400_000)
          .reduce((n, r) => n + r.attempts, 0),
      });
      const entryId = recipeTarget
        ? null
        : (input.entry_id ?? input.operation_id);
      if (!recipeTarget && entryId && !input.entry_id) {
        // A direct brew photo uses a dedicated hidden NOTE; retries reuse its stable ID.
        const collision = await tx.brew_entries.findUnique({
          where: { id: entryId },
        });
        if (
          collision &&
          (collision.brew_id !== brewId ||
            (collision.data as { imageAttachment?: boolean } | null)
              ?.imageAttachment !== true)
        )
          throw new BrewImageError("OPERATION_CONFLICT");
        if (!collision)
          await tx.brew_entries.create({
            data: {
              id: entryId,
              brew_id: brewId,
              user_id: userId,
              type: "NOTE",
              title: null,
              data: { hidden: true, imageAttachment: true },
            },
          });
      }
      const prefix = `${brewImageStorageEnvironment()}/${recipeTarget ? "recipes" : "brews"}/${brewId}/${input.operation_id}/${randomUUID()}`;
      const data = {
        ...parentWhere(brewId),
        ...originalWhere(brewId),
        entry_id: entryId,
        original_entry_id: entryId,
        user_id: userId,
        status: "pending",
        request_hash: hash,
        image_key: `${prefix}/image.webp`,
        thumbnail_key: `${prefix}/thumbnail.webp`,
        caption: input.caption,
        reserved_bytes: reserved,
        cleanup_after: new Date(Date.now() + 10 * 60_000),
      };
      const image = previous
        ? await tx.brew_images.update({
            where: { id: previous.id },
            include: entryInclude,
            data: { ...data, attempts: { increment: 1 } },
          })
        : await tx.brew_images.create({
            data: { ...data, id: input.operation_id },
            include: entryInclude,
          });
      return { replay: false, image };
    });
    if (reservation.replay)
      return { image: projectBrewImage(reservation.image) };
    const record = reservation.image;
    try {
      const output = await normalize(bytes, input.content_type);
      // Sequential writes make partial success and cleanup deterministic.
      await store.put(record.image_key, output.image);
      await store.put(record.thumbnail_key, output.thumbnail);
      const saved = await db.$transaction(async (tx) => {
        await lockAccount(tx, userId);
        await ownedParent(tx, userId, brewId);
        const entryExists =
          record.entry_id &&
          (await tx.brew_entries.findFirst({
            where: { id: record.entry_id, brew_id: brewId },
            select: { id: true },
          }));
        if (!recipeTarget && !entryExists)
          throw new BrewImageError("NOT_FOUND");
        const status = await getPremiumAccessStatus(userId, new Date(), tx);
        if (!status.premiumEnabled)
          throw new BrewImageError("PREMIUM_REQUIRED");
        const updated = await tx.brew_images.updateMany({
          where: {
            id: record.id,
            status: "pending",
            removed: false,
            image_key: record.image_key,
          },
          data: {
            status: "ready",
            width: output.width,
            height: output.height,
            size_bytes: output.image.length + output.thumbnail.length,
            reserved_bytes: output.image.length + output.thumbnail.length,
          },
        });
        if (!updated.count) throw new BrewImageError("OPERATION_CONFLICT");
        if (recipeTarget)
          await tx.recipes.update({
            where: { id: Number(brewId) },
            data: { cover_image_id: record.id },
          });
        else if (input.set_as_cover)
          await tx.brews.update({
            where: { id: brewId },
            data: { cover_image_id: record.id },
          });
        return tx.brew_images.findUniqueOrThrow({
          where: { id: record.id },
          include: entryInclude,
        });
      });
      return { image: projectBrewImage(saved) };
    } catch (error) {
      // Even a timed-out PUT may have reached R2: defer physical deletion beyond the writer lease.
      await db.brew_images.updateMany({
        where: {
          id: record.id,
          image_key: record.image_key,
          status: "pending",
        },
        data: { status: "deleting" },
      });
      if (error instanceof BrewImageError) throw error;
      throw new BrewImageError("UPLOAD_FAILED");
    }
  }

  async function update(
    userId: number,
    brewId: string,
    imageId: string,
    caption: string,
  ) {
    return db.$transaction(async (tx) => {
      await lockAccount(tx, userId);
      await ownedParent(tx, userId, brewId);
      const image = await tx.brew_images.findFirst({
        where: {
          id: imageId,
          user_id: userId,
          ...parentWhere(brewId),
          status: "ready",
          removed: false,
        },
      });
      if (!image) throw new BrewImageError("NOT_FOUND");
      const updated = await tx.brew_images.update({
        where: { id: imageId },
        data: { caption },
        include: entryInclude,
      });
      return { image: projectBrewImage(updated) };
    });
  }
  async function remove(userId: number, brewId: string, imageId: string) {
    await db.$transaction(async (tx) => {
      await lockAccount(tx, userId);
      await ownedParent(tx, userId, brewId);
      const image = await tx.brew_images.findFirst({
        where: { id: imageId, user_id: userId, ...originalWhere(brewId) },
      });
      if (!image) throw new BrewImageError("NOT_FOUND");
      await tx.brews.updateMany({
        where: { cover_image_id: imageId },
        data: { cover_image_id: null },
      });
      await tx.recipes.updateMany({
        where: { cover_image_id: imageId },
        data: { cover_image_id: null },
      });
      if (["deleted", "failed"].includes(image.status)) {
        await tx.brew_images.update({
          where: { id: image.id },
          data: { removed: true, status: "deleted" },
        });
      } else {
        await queueBrewImageRemoval(tx, { id: imageId });
        // Already deleting (e.g. failed upload) still needs a terminal removal marker.
        await tx.brew_images.update({
          where: { id: imageId },
          data: { removed: true },
        });
      }
    });
    return { removed: true as const };
  }
  async function signedRead(
    brewId: string,
    imageId: string,
    variant: "image" | "thumbnail",
    userId?: number,
  ) {
    await access(brewId, userId);
    const image = await db.brew_images.findFirst({
      where: {
        id: imageId,
        ...parentWhere(brewId),
        status: "ready",
        removed: false,
        ...readableImages,
      },
    });
    if (!image) throw new BrewImageError("NOT_FOUND");
    return {
      url: await storage().signedRead(
        variant === "thumbnail" ? image.thumbnail_key : image.image_key,
      ),
      expires_at: new Date(Date.now() + limits.urlSeconds * 1000).toISOString(),
    };
  }

  /** Durable rows, retained after brew deletion, are the cleanup queue. */
  async function cleanup(now = new Date()) {
    const candidates = await db.brew_images.findMany({
      where: {
        OR: [
          {
            status: { in: ["pending", "deleting"] },
            cleanup_after: { lte: now },
          },
          {
            status: "ready",
            OR: [
              { original_brew_id: { not: null }, brew_id: null },
              { original_recipe_id: { not: null }, recipe_id: null },
              { user: { active: false } },
              { original_entry_id: { not: null }, entry_id: null },
            ],
          },
        ],
      },
      orderBy: { cleanup_after: "asc" },
      take: 50,
    });
    let cleaned = 0;
    let failed = 0;
    const deadline = Date.now() + 30_000;
    for (const candidate of candidates) {
      if (Date.now() > deadline) break;
      try {
        const claimed = await db.$transaction(async (tx) => {
          // Inactive users must still be cleanable. Same lock order as mutations.
          await tx.$queryRaw`SELECT id FROM users WHERE id = ${candidate.user_id} FOR NO KEY UPDATE`;
          const row = await tx.brew_images.findUnique({
            where: { id: candidate.id },
          });
          if (
            !row ||
            row.image_key !== candidate.image_key ||
            !["pending", "deleting", "ready"].includes(row.status)
          )
            return null;
          if (row.status === "ready") {
            const owner = await tx.users.findUnique({
              where: { id: row.user_id },
              select: { active: true },
            });
            if (
              (row.brew_id || row.recipe_id) &&
              owner?.active &&
              (!row.original_entry_id || row.entry_id)
            )
              return null;
          } else if (row.cleanup_after > now) return null;
          return tx.brew_images.update({
            where: { id: row.id },
            data: {
              status: "deleting",
              removed: row.removed || row.status === "ready",
              cleanup_after: new Date(now.getTime() + 10 * 60_000),
            },
          });
        });
        if (!claimed) continue;
        const store = storage();
        await store.remove(claimed.image_key);
        await store.remove(claimed.thumbnail_key);
        await db.brew_images.updateMany({
          where: {
            id: claimed.id,
            image_key: claimed.image_key,
            status: "deleting",
          },
          data: {
            status: claimed.removed ? "deleted" : "failed",
            reserved_bytes: 0,
            size_bytes: 0,
          },
        });
        if (claimed.entry_id) {
          await db.$transaction(async (tx) => {
            await tx.$queryRaw`SELECT id FROM users WHERE id = ${claimed.user_id} FOR NO KEY UPDATE`;
            const entry = await tx.brew_entries.findUnique({
              where: { id: claimed.entry_id! },
              select: { data: true },
            });
            if (
              (entry?.data as { imageAttachment?: boolean } | null)
                ?.imageAttachment &&
              !(await tx.brew_images.count({
                where: { entry_id: claimed.entry_id, status: { in: charged } },
              }))
            ) {
              await tx.brew_entries.delete({
                where: { id: claimed.entry_id! },
              });
            }
          });
        }
        cleaned++;
      } catch {
        failed++;
      }
    }
    // Bounded tombstone retention preserves retries for a month without unbounded metadata.
    await db.brew_images.deleteMany({
      where: {
        status: { in: ["failed", "deleted"] },
        updated_at: { lt: new Date(now.getTime() - 30 * 86_400_000) },
      },
    });
    return { cleaned, failed };
  }
  async function cover(brewId: string, userId?: number) {
    const parent = await access(brewId, userId);
    const image = parent.cover_image_id
      ? await db.brew_images.findFirst({
          where: {
            id: parent.cover_image_id,
            ...parentWhere(brewId),
            status: "ready",
            removed: false,
            ...readableImages,
          },
          include: entryInclude,
        })
      : null;
    const status =
      userId !== undefined && parent.user_id === userId
        ? await getPremiumAccessStatus(userId, new Date(), db)
        : null;
    return {
      image: image ? projectBrewImage(image) : null,
      can_set: Boolean(status?.premiumEnabled),
    };
  }
  async function setCover(
    userId: number,
    brewId: string,
    imageId: string | null,
  ) {
    await db.$transaction(async (tx) => {
      await lockAccount(tx, userId);
      await ownedParent(tx, userId, brewId);
      // Owners retain removal after expiry, but selecting/replacing requires premium.
      if (imageId) {
        const status = await getPremiumAccessStatus(userId, new Date(), tx);
        if (!status.premiumEnabled)
          throw new BrewImageError("PREMIUM_REQUIRED");
        const image = await tx.brew_images.findFirst({
          where: {
            id: imageId,
            user_id: userId,
            ...parentWhere(brewId),
            status: "ready",
            removed: false,
            ...readableImages,
          },
        });
        if (!image) throw new BrewImageError("NOT_FOUND");
      }
      if (recipeTarget)
        await tx.recipes.update({
          where: { id: Number(brewId) },
          data: { cover_image_id: imageId },
        });
      else
        await tx.brews.update({
          where: { id: brewId },
          data: { cover_image_id: imageId },
        });
    });
    return cover(brewId, userId);
  }
  return { list, upload, update, remove, signedRead, cleanup, cover, setCover };
}

export type BrewImageRecord = brew_images;

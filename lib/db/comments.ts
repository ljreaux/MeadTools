import prisma from "../prisma";
import { notifyRecipeOwnerOfActivity } from "./activityEmailUpdates";

function sanitizeRating(n: number): 1 | 2 | 3 | 4 | 5 {
  const r = Math.round(Number(n));
  if (r < 1 || r > 5) throw new Error("Invalid recipe rating (must be 1–5).");
  return r as 1 | 2 | 3 | 4 | 5;
}

export async function setRating(input: {
  recipe_id: number;
  user_id: number;
  rating: number;
}) {
  const { recipe_id, user_id } = input;
  const userRating = sanitizeRating(input.rating);

  // Upsert the rating, then recompute stats atomically
  const [, agg, count] = await prisma.$transaction([
    prisma.recipe_ratings.upsert({
      where: { recipe_id_user_id: { recipe_id, user_id } }, // composite unique
      update: { rating: userRating }, // @updatedAt handled by Prisma if present
      create: { recipe_id, user_id, rating: userRating }
    }),
    prisma.recipe_ratings.aggregate({
      where: { recipe_id },
      _avg: { rating: true }
    }),
    prisma.recipe_ratings.count({
      where: { recipe_id }
    })
  ]);

  const averageRating = Number((agg._avg.rating ?? 0).toFixed(2));
  const numberOfRatings = count;

  notifyRecipeOwnerOfActivity({
    recipeId: recipe_id,
    kind: "rating",
    ratingValue: userRating,
    actorUserId: user_id
  }).catch((err) =>
    console.error("Failed to send recipe activity email:", err)
  );

  return {
    recipe_id,
    averageRating,
    numberOfRatings,
    userRating
  };
}

const MAX_COMMENT_LENGTH = 10_000;

type CreateCommentInput = {
  recipe_id: number; // FK -> recipes.id
  user_id: number; // FK -> users.id (provided by the route after auth)
  comment: string; // markdown text
  parent_id?: string | null; // FK -> comments.id (uuid) for replies
};

type CreatedComment = {
  id: string; // uuid
  recipe_id: number;
  user_id: number;
  parent_id: string | null;
  comment: string;
  created_at: Date;
  updated_at: Date;
};

function sanitizeBody(raw: unknown): string {
  if (typeof raw !== "string") throw new Error("Comment must be a string.");
  const trimmed = raw.trim();
  if (!trimmed) throw new Error("Comment cannot be empty.");
  if (trimmed.length > MAX_COMMENT_LENGTH) {
    throw new Error(`Comment exceeds ${MAX_COMMENT_LENGTH} characters.`);
  }
  return trimmed;
}

/**
 * Helper: map DB author shape -> public shape used by the UI
 */
type DbAuthor = {
  public_username: string | null;
  google_avatar_url: string | null;
  show_google_avatar: boolean;
} | null;

function toPublicAuthor(author: DbAuthor) {
  if (!author) return null;
  return {
    public_username: author.public_username,
    avatarUrl:
      author.show_google_avatar && author.google_avatar_url
        ? author.google_avatar_url
        : null
  };
}

/**
 * Helper: if deleted_at is set, blank the comment text before sending to client.
 * Keeps original text in DB but never exposes it via API.
 */
function maskCommentForDeleted<
  T extends { comment: string; deleted_at: Date | null }
>(row: T): T {
  if (!row.deleted_at) return row;
  return {
    ...row,
    comment: ""
  };
}

export async function createComment(
  input: CreateCommentInput
): Promise<CreatedComment> {
  const { recipe_id, user_id } = input;
  const parent_id = input.parent_id ?? null;
  const comment = sanitizeBody(input.comment);

  // Validate references
  const [recipe, user, parent] = await Promise.all([
    prisma.recipes.findUnique({
      where: { id: recipe_id },
      select: { id: true }
    }),
    prisma.users.findUnique({ where: { id: user_id }, select: { id: true } }),
    parent_id
      ? prisma.comments.findUnique({
          where: { id: parent_id },
          select: { id: true, recipe_id: true, deleted_at: true }
        })
      : Promise.resolve(null)
  ]);

  if (!recipe) throw new Error("Recipe not found.");
  if (!user) throw new Error("User not found.");

  if (parent) {
    if (parent.recipe_id !== recipe_id) {
      throw new Error("Reply must reference a comment on the same recipe.");
    }
    if (parent.deleted_at) {
      throw new Error("Cannot reply to a deleted comment.");
    }
  }

  const created = await prisma.comments.create({
    data: { recipe_id, user_id, parent_id, comment },
    select: {
      id: true,
      recipe_id: true,
      user_id: true,
      parent_id: true,
      comment: true,
      created_at: true,
      updated_at: true
    }
  });

  // Fire email asynchronously (non-blocking)
  notifyRecipeOwnerOfActivity({
    recipeId: recipe_id,
    kind: "comment",
    commentSnippet: comment,
    actorUserId: user_id
  }).catch((err) =>
    console.error("Failed to send recipe activity email:", err)
  );

  /** 3. Immediately return comment */
  return created;
}

export async function updateComment(input: {
  id: string;
  user_id: number;
  comment: string;
}): Promise<CreatedComment> {
  const { id, user_id } = input;
  const comment = sanitizeBody(input.comment);

  // Make sure comment exists, belongs to user, and is not deleted
  const existing = await prisma.comments.findUnique({
    where: { id },
    select: {
      id: true,
      user_id: true,
      deleted_at: true,
      recipe_id: true,
      parent_id: true,
      comment: true,
      created_at: true,
      updated_at: true
    }
  });

  if (!existing) {
    throw new Error("Comment not found.");
  }

  if (existing.user_id !== user_id) {
    throw new Error("You can only edit your own comments.");
  }

  if (existing.deleted_at) {
    throw new Error("Cannot edit a deleted comment.");
  }

  const updated = await prisma.comments.update({
    where: { id },
    data: { comment },
    select: {
      id: true,
      recipe_id: true,
      user_id: true,
      parent_id: true,
      comment: true,
      created_at: true,
      updated_at: true
    }
  });

  return updated;
}

export async function deleteComment(input: {
  id: string;
  user_id: number;
}): Promise<{ id: string; deleted_at: Date | null }> {
  const { id, user_id } = input;

  const existing = await prisma.comments.findUnique({
    where: { id },
    select: {
      id: true,
      user_id: true,
      deleted_at: true
    }
  });

  if (!existing) {
    throw new Error("Comment not found.");
  }

  if (existing.user_id !== user_id) {
    throw new Error("You can only delete your own comments.");
  }

  // Make delete idempotent: if already deleted, just return the existing timestamp
  if (existing.deleted_at) {
    return { id: existing.id, deleted_at: existing.deleted_at };
  }

  const deleted = await prisma.comments.update({
    where: { id },
    data: { deleted_at: new Date() },
    select: {
      id: true,
      deleted_at: true
    }
  });

  return deleted;
}

type RootCommentRow = {
  id: string;
  recipe_id: number;
  user_id: number;
  parent_id: null;
  comment: string;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
  reply_count: number;
  author: {
    public_username: string | null;
    avatarUrl: string | null;
  } | null;
};

export async function listRootCommentsForRecipe(opts: {
  recipe_id: number;
  limit?: number; // default 20
  cursor?: string | null; // comment.id
  order?: "asc" | "desc"; // default "asc"
}): Promise<{
  data: RootCommentRow[];
  nextCursor: string | null;
  totalCount: number;
}> {
  const { recipe_id, cursor = null, limit = 20, order = "asc" } = opts;

  // We include deleted roots so the UI can show "deleted" placeholders.
  const where = {
    recipe_id,
    parent_id: null as null
  };

  const [raw, totalCount] = await Promise.all([
    prisma.comments.findMany({
      where,
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: [{ created_at: order }],
      select: {
        id: true,
        recipe_id: true,
        user_id: true,
        parent_id: true,
        comment: true,
        created_at: true,
        updated_at: true,
        deleted_at: true,
        _count: { select: { replies: true } }, // reply_count
        author: {
          select: {
            public_username: true,
            google_avatar_url: true,
            show_google_avatar: true
          }
        }
      }
    }),
    prisma.comments.count({ where })
  ]);

  let nextCursor: string | null = null;
  if (raw.length > limit) {
    nextCursor = raw[limit]!.id;
    raw.splice(limit);
  }

  const data: RootCommentRow[] = raw.map((c) => {
    const masked = maskCommentForDeleted(c);

    return {
      id: masked.id,
      recipe_id: masked.recipe_id,
      user_id: masked.user_id,
      parent_id: null,
      comment: masked.comment,
      created_at: masked.created_at,
      updated_at: masked.updated_at,
      deleted_at: masked.deleted_at,
      reply_count: c._count.replies,
      author: toPublicAuthor(c.author)
    };
  });

  return { data, nextCursor, totalCount };
}

type ReplyRow = {
  id: string;
  recipe_id: number;
  user_id: number;
  parent_id: string;
  comment: string;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
  reply_count: number;
  author: {
    public_username: string | null;
    avatarUrl: string | null;
  } | null;
};

export async function listRepliesForParent(opts: {
  recipe_id: number;
  parent_id: string;
  limit?: number;
  cursor?: string | null;
  order?: "asc" | "desc";
}): Promise<{
  data: ReplyRow[];
  nextCursor: string | null;
  totalCount: number;
}> {
  const {
    recipe_id,
    parent_id,
    cursor = null,
    limit = 20,
    order = "asc"
  } = opts;

  const where = {
    recipe_id,
    parent_id
  };

  const [raw, totalCount] = await Promise.all([
    prisma.comments.findMany({
      where,
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: [{ created_at: order }],
      select: {
        id: true,
        recipe_id: true,
        user_id: true,
        parent_id: true,
        comment: true,
        created_at: true,
        updated_at: true,
        deleted_at: true,
        _count: { select: { replies: true } }, // 👈 add this
        author: {
          select: {
            public_username: true,
            google_avatar_url: true,
            show_google_avatar: true
          }
        }
      }
    }),
    prisma.comments.count({ where })
  ]);

  let nextCursor: string | null = null;
  if (raw.length > limit) {
    nextCursor = raw[limit]!.id;
    raw.splice(limit);
  }

  const data: ReplyRow[] = raw.map((c) => ({
    id: c.id,
    recipe_id: c.recipe_id,
    user_id: c.user_id,
    parent_id: c.parent_id!, // non-null by where
    comment: c.comment,
    created_at: c.created_at,
    updated_at: c.updated_at,
    deleted_at: c.deleted_at,
    reply_count: c._count.replies, // 👈 here
    author: c.author
      ? {
          public_username: c.author.public_username,
          avatarUrl:
            c.author.show_google_avatar && c.author.google_avatar_url
              ? c.author.google_avatar_url
              : null
        }
      : null
  }));

  return { data, nextCursor, totalCount };
}

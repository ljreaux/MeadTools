"use client";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient
} from "@tanstack/react-query";
import { useFetchWithAuth } from "@/hooks/auth/useFetchWithAuth";
import { qk } from "@/lib/db/queryKeys";

/**
 * Paginated top-level comments (parent_id IS NULL)
 * GET /api/recipes/:id/comments/roots
 */
export function useComments(
  recipeId: number,
  limit = 20,
  order: "asc" | "desc" = "asc"
) {
  return useInfiniteQuery({
    queryKey: [...qk.comments(recipeId), "roots", limit, order],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      fetch(
        `/api/recipes/${recipeId}/comments/roots?limit=${limit}${pageParam ? `&cursor=${pageParam}` : ""}&order=${order}`
      ).then(async (r) => {
        const j = await r.json().catch(() => null);
        if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);
        return j;
      }),
    getNextPageParam: (last) => last.nextCursor
  });
}

/**
 * Paginated replies for a specific parent comment
 * GET /api/recipes/:id/comments/:commentId/replies
 */
export function useCommentThread(
  recipeId: number,
  parentId: string,
  limit = 20,
  order: "asc" | "desc" = "asc",
  enabled = true
) {
  return useInfiniteQuery({
    queryKey: [...qk.comments(recipeId), "thread", parentId, limit, order],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      fetch(
        `/api/recipes/${recipeId}/comments/${parentId}/replies?limit=${limit}${
          pageParam ? `&cursor=${pageParam}` : ""
        }&order=${order}`
      ).then(async (r) => {
        const j = await r.json().catch(() => null);
        if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);
        return j;
      }),
    getNextPageParam: (last) => last.nextCursor,
    enabled
  });
}
/**
 * Create a comment (root or reply).
 */
export function useCreateComment(recipeId: number) {
  const qc = useQueryClient();
  const fetchWithAuth = useFetchWithAuth();

  return useMutation({
    mutationFn: (body: { comment: string; parent_id?: string | null }) =>
      fetchWithAuth<{ comment: any }>(`/api/recipes/${recipeId}/comments`, {
        method: "POST",
        body: JSON.stringify({
          comment: body.comment,
          parent_id: body.parent_id ?? null
        })
      }),

    onMutate: async (vars) => {
      // Cancel all comment queries for this recipe
      await qc.cancelQueries({ queryKey: ["comments"], exact: false });

      const prevEntries = qc.getQueriesData<any>({
        queryKey: ["comments"]
      });

      const optimistic = {
        id: `temp-${Date.now()}`,
        recipe_id: recipeId,
        user_id: 0,
        parent_id: vars.parent_id ?? null,
        comment: vars.comment,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
        // roots have reply_count, replies usually don't
        reply_count: 0,
        author: { public_username: "You", avatarUrl: null }
      };

      for (const [key, data] of prevEntries) {
        if (!data?.pages?.length) continue;

        const parts = key as (string | number)[];
        const [root0, maybeRecipeId, type, maybeParentId] = parts;

        if (root0 !== "comments") continue;
        if (maybeRecipeId !== recipeId) continue;

        // Root list
        if (!vars.parent_id && type === "roots") {
          const first = data.pages[0];
          qc.setQueryData(key, {
            ...data,
            pages: [
              { ...first, data: [optimistic, ...first.data] },
              ...data.pages.slice(1)
            ]
          });
          continue;
        }

        // If this is a roots query and we're replying to a root,
        // bump reply_count on that root. (We do NOT decrement on delete.)
        if (vars.parent_id && type === "roots") {
          const nextPages = data.pages.map((page: any) => ({
            ...page,
            data: page.data.map((c: any) =>
              c.id === vars.parent_id
                ? { ...c, reply_count: (c.reply_count ?? 0) + 1 }
                : c
            )
          }));
          qc.setQueryData(key, { ...data, pages: nextPages });
        }

        // Thread query for this parent: add optimistic reply to the top
        if (
          vars.parent_id &&
          type === "thread" &&
          maybeParentId === vars.parent_id
        ) {
          const first = data.pages[0];
          qc.setQueryData(key, {
            ...data,
            pages: [
              { ...first, data: [optimistic, ...first.data] },
              ...data.pages.slice(1)
            ]
          });
        }
      }

      return { prevEntries };
    },

    onError: (_e, _v, ctx) => {
      if (!ctx?.prevEntries) return;
      for (const [key, data] of ctx.prevEntries) {
        qc.setQueryData(key, data);
      }
    },

    onSettled: (_data, _error, vars) => {
      // Always refetch roots (for canonical reply_count, etc.)
      qc.invalidateQueries({
        queryKey: ["comments", recipeId, "roots"],
        exact: false
      });

      // If this was a reply, also refetch that thread
      if (vars.parent_id) {
        qc.invalidateQueries({
          queryKey: ["comments", recipeId, "thread", vars.parent_id],
          exact: false
        });
      }
    }
  });
}
/**
 * Edit comment
 */
export function useUpdateComment(recipeId: number) {
  const qc = useQueryClient();
  const fetchWithAuth = useFetchWithAuth();
  const baseKey = qk.comments(recipeId);

  return useMutation({
    mutationFn: (vars: { id: string; comment: string }) =>
      fetchWithAuth<{ comment: any }>(`/api/comments/${vars.id}`, {
        method: "PATCH",
        body: JSON.stringify({ comment: vars.comment })
      }),

    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: baseKey, exact: false });
      const prevEntries = qc.getQueriesData<any>({ queryKey: baseKey });

      for (const [key, data] of prevEntries) {
        if (!data?.pages) continue;

        const nextPages = data.pages.map((page: any) => ({
          ...page,
          data: page.data.map((c: any) =>
            c.id === vars.id
              ? {
                  ...c,
                  comment: vars.comment,
                  updated_at: new Date().toISOString()
                }
              : c
          )
        }));

        qc.setQueryData(key, { ...data, pages: nextPages });
      }

      return { prevEntries };
    },

    onError: (_e, _v, ctx) => {
      if (!ctx?.prevEntries) return;
      for (const [key, data] of ctx.prevEntries) {
        qc.setQueryData(key, data);
      }
    },

    onSettled: () => {
      qc.invalidateQueries({ queryKey: baseKey, exact: false });
    }
  });
}

/**
 * Delete comment (soft delete)
 */
export function useDeleteComment(recipeId: number) {
  const qc = useQueryClient();
  const fetchWithAuth = useFetchWithAuth();
  const baseKey = qk.comments(recipeId);

  return useMutation({
    mutationFn: (vars: { id: string }) =>
      fetchWithAuth<{ deleted: boolean }>(`/api/comments/${vars.id}`, {
        method: "DELETE"
      }),

    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: baseKey, exact: false });
      const prevEntries = qc.getQueriesData<any>({ queryKey: baseKey });

      for (const [key, data] of prevEntries) {
        if (!data?.pages) continue;

        const nextPages = data.pages.map((page: any) => ({
          ...page,
          data: page.data.map((c: any) =>
            c.id === vars.id
              ? { ...c, deleted_at: new Date().toISOString() }
              : c
          )
        }));

        qc.setQueryData(key, { ...data, pages: nextPages });
      }

      return { prevEntries };
    },

    onError: (_e, _v, ctx) => {
      if (!ctx?.prevEntries) return;
      for (const [key, data] of ctx.prevEntries) {
        qc.setQueryData(key, data);
      }
    },

    onSettled: () => {
      qc.invalidateQueries({ queryKey: baseKey, exact: false });
    }
  });
}

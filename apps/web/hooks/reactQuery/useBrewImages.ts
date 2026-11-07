"use client";
import { useCallback, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/auth/useAuth";
import { useAuthToken } from "@/hooks/auth/useAuthToken";
import { BrewImageError } from "@meadtools/brew-domain/images";
import {
  brewImagesResponseSchema,
  brewImageErrorResponseSchema,
  coverImageResponseSchema,
} from "@meadtools/api-contract/brew-images";
import type { CreateBrewImageRequestBody } from "@meadtools/api-contract/contracts";
import { uploadBrewImage } from "@/lib/brews/uploadBrewImage";
import { prepareBrewImage } from "@/lib/brews/prepareBrewImage";
import { qk } from "@/lib/db/queryKeys";

export type ImageTarget = "brews" | "recipes";

/** Image endpoints send credentials only for owner reads; public reads stay anonymous. */
export function useImageRequest(publicView = false) {
  const token = useAuthToken();
  const { user } = useAuth();
  const request = useCallback(
    async (path: string, init?: RequestInit): Promise<unknown> => {
      const response = await fetch(path, {
        ...init,
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          ...(token && !publicView ? { Authorization: `Bearer ${token}` } : {}),
          ...init?.headers,
        },
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        const error = brewImageErrorResponseSchema.safeParse(body);
        throw new BrewImageError(
          error.success ? error.data.code : "UPLOAD_FAILED",
        );
      }
      return body;
    },
    [token, publicView],
  );
  return { request, token, userId: user?.id };
}

export function useBrewImagesOverview(
  recordId: string,
  publicView = false,
  target: ImageTarget = "brews",
  enabled = true,
) {
  const { request, token, userId } = useImageRequest(publicView);
  const overview = useQuery({
    queryKey: ["brew-images", target, recordId, publicView ? "public" : userId],
    queryFn: async () =>
      brewImagesResponseSchema.parse(
        await request(
          `/api/${target}/${recordId}/images${publicView ? "?public=true" : ""}`,
        ),
      ),
    enabled: enabled && (publicView || Boolean(userId)),
    gcTime: 0,
    retry: 1,
  });
  return { overview, request, token, userId };
}

export const recordCoverKey = (target: ImageTarget, recordId: string) =>
  ["record-cover", target, recordId] as const;

/** Reads the current cover; visibility is rechecked by the server on every read. */
export function useRecordCover(
  recordId: string,
  target: ImageTarget,
  { publicView = false, enabled = true } = {},
) {
  const { request, userId } = useImageRequest(publicView);
  const queryClient = useQueryClient();
  const cover = useQuery({
    queryKey: [
      ...recordCoverKey(target, recordId),
      publicView ? "public" : userId,
    ],
    queryFn: async () =>
      coverImageResponseSchema.parse(
        await request(
          `/api/${target}/${recordId}/cover${publicView ? "?public=true" : ""}`,
        ),
      ),
    enabled: enabled && (publicView || Boolean(userId)),
    staleTime: 30_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
  /** Covers appear on lists that carry cover_image_id, so refresh those too. */
  const refreshCover = useCallback(async () => {
    // Lists only; never the open record, so unsaved edits are not refetched over.
    void queryClient.invalidateQueries({
      queryKey: target === "recipes" ? qk.accountInfo : qk.accountBrews.list(),
    });
    await queryClient.invalidateQueries({
      queryKey: recordCoverKey(target, recordId),
    });
  }, [queryClient, recordId, target]);
  const setCover = useCallback(
    async (imageId: string | null) => {
      await request(`/api/${target}/${recordId}/cover`, {
        method: "PATCH",
        body: JSON.stringify({ image_id: imageId }),
      });
      await refreshCover();
    },
    [recordId, refreshCover, request, target],
  );
  return { cover, request, setCover, refreshCover };
}

/** Shared prepare → upload → retry state for gallery, entry and cover uploads. */
export function useRecordImageUpload({
  recordId,
  target,
  token,
  entryId,
  setAsCover = false,
  onUploaded,
}: {
  recordId: string;
  target: ImageTarget;
  token: string | null;
  entryId?: string;
  setAsCover?: boolean;
  onUploaded: () => Promise<unknown>;
}) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [pending, setPending] = useState<CreateBrewImageRequestBody | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const showError = useCallback(
    (cause: unknown) => {
      const code =
        cause instanceof BrewImageError ? cause.code : "UPLOAD_FAILED";
      setError(
        t(
          target === "recipes" && code === "BREW_IMAGE_LIMIT"
            ? "coverImages.recipeLimit"
            : `brewImages.errors.${code}`,
        ),
      );
    },
    [t, target],
  );
  async function upload(body: CreateBrewImageRequestBody) {
    setBusy(true);
    setError(null);
    setProgress(0);
    setPending(body);
    try {
      await uploadBrewImage(
        recordId,
        {
          ...body,
          ...(entryId ? { entry_id: entryId } : {}),
          // Recipe uploads always become the cover server-side.
          ...(setAsCover && target === "brews" ? { set_as_cover: true } : {}),
        },
        token,
        setProgress,
        target,
      );
      setPending(null);
      await onUploaded();
    } catch (cause) {
      showError(cause);
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }
  async function selectFile(file?: File) {
    if (!file || busy) return;
    setBusy(true);
    setError(null);
    setPending(null);
    try {
      const prepared = await prepareBrewImage(file);
      await upload({
        ...prepared,
        operation_id: crypto.randomUUID(),
        caption: "",
      });
    } catch (cause) {
      showError(cause);
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }
  return {
    busy,
    progress,
    pending,
    error,
    setError,
    showError,
    fileInput,
    selectFile,
    retry: () => (pending ? upload(pending) : Promise.resolve()),
  };
}

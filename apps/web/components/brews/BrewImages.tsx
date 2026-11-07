"use client";

import { useRef, useState, type MouseEventHandler } from "react";
import Image from "next/image";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { ImageOff } from "lucide-react";
import { BREW_IMAGE_LIMITS as limits } from "@meadtools/brew-domain/images";
import { brewImageAccessResponseSchema } from "@meadtools/api-contract/brew-images";
import type { BrewImageResponse } from "@meadtools/api-contract/contracts";
import {
  useBrewImagesOverview,
  useRecordCover,
  useRecordImageUpload,
  type ImageTarget,
} from "@/hooks/reactQuery/useBrewImages";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BrewImageUploadProgress } from "./BrewImageUploadProgress";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";

type RequestJson = (path: string, init?: RequestInit) => Promise<unknown>;

/**
 * Renders one stored image through a short-lived signed URL.
 * `compact` fills its parent (cover thumbnails and picker tiles): it is
 * decorative, never interactive, and shows an icon instead of a retry button.
 */
export function Photo({
  image,
  target = "brews",
  brewId,
  publicView,
  full,
  compact = false,
  hiRes = false,
  request,
  onOpen,
}: {
  image: BrewImageResponse;
  target?: ImageTarget;
  brewId: string;
  publicView: boolean;
  full?: boolean;
  compact?: boolean;
  /** Fetch the display image instead of the thumbnail (cover banners). */
  hiRes?: boolean;
  request: RequestJson;
  onOpen?: MouseEventHandler<HTMLButtonElement>;
}) {
  const { t } = useTranslation();
  const previewClass = compact ? "size-full" : "aspect-square w-full";
  const retried = useRef(false);
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  const [imageFailed, setImageFailed] = useState(false);
  const [readAttempt, setReadAttempt] = useState(0);
  const access = useQuery({
    queryKey: [
      "brew-image-access",
      target,
      brewId,
      image.id,
      publicView,
      Boolean(full || hiRes),
    ],
    queryFn: async () =>
      brewImageAccessResponseSchema.parse(
        await request(
          `/api/${target}/${brewId}/images/${image.id}?variant=${full || hiRes ? "image" : "thumbnail"}${publicView ? "&public=true" : ""}`,
        ),
      ),
    staleTime: 30_000,
    gcTime: 0,
    retry: 1,
    refetchOnWindowFocus: false,
  });
  function retryRead() {
    retried.current = false;
    setImageFailed(false);
    setLoadedUrl(null);
    void access.refetch().then(() => setReadAttempt((attempt) => attempt + 1));
  }
  if (access.isError || imageFailed)
    return compact ? (
      <div
        className="flex size-full items-center justify-center bg-muted"
        role="img"
        aria-label={t("brewImages.unavailablePhoto")}
      >
        <ImageOff className="size-1/3 max-h-6 max-w-6 text-muted-foreground" />
      </div>
    ) : (
      <Button
        type="button"
        variant="outline"
        className={full ? undefined : "aspect-square h-auto w-full whitespace-normal"}
        onClick={retryRead}
      >
        {t("brewImages.retry")}
      </Button>
    );
  if (!access.data)
    return (
      <div
        role="status"
        aria-label={t("brewImages.loading")}
        className={compact ? "size-full" : undefined}
      >
        <Skeleton
          className={full ? "h-64 w-full" : cn(previewClass, compact && "rounded-none")}
        />
      </div>
    );
  // Private short-lived URLs must bypass Next's publicly cached image optimizer.
  const loaded = loadedUrl === access.data.url;
  const content = (
    <div
      className={full ? "relative min-h-32" : `relative ${previewClass}`}
      aria-busy={!loaded}
    >
      {!loaded && (
        <Skeleton
          className={cn("absolute inset-0", compact && "rounded-none")}
          aria-hidden="true"
        />
      )}
      <Image
        key={readAttempt}
        unoptimized
        src={access.data.url}
        alt={
          compact
            ? ""
            : image.caption ||
              t(
                target === "recipes"
                  ? "coverImages.recipePhoto"
                  : "brewImages.photoAlt",
              )
        }
        width={image.width}
        height={image.height}
        loading={full ? "eager" : "lazy"}
        referrerPolicy="no-referrer"
        className={
          full
            ? "max-h-[65dvh] w-full object-contain"
            : cn(previewClass, "object-cover", !compact && "rounded-md")
        }
        onLoad={() => setLoadedUrl(access.data.url)}
        onError={() => {
          if (!retried.current) {
            retried.current = true;
            setLoadedUrl(null);
            // A same-second signature can return the same URL. Remount the image
            // after refreshing it so the browser still retries the failed GET.
            void access
              .refetch()
              .then(() => setReadAttempt((attempt) => attempt + 1));
          } else {
            setImageFailed(true);
          }
        }}
      />
    </div>
  );
  return full || compact || !onOpen ? (
    content
  ) : (
    <button
      type="button"
      className="block w-full rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label={image.caption || t("brewImages.openPhoto")}
      onClick={onOpen}
    >
      {content}
    </button>
  );
}

/** Brew gallery (Photos tab) and per-entry attachments. Recipe photos live in the cover picker. */
export function BrewImages({
  brewId,
  publicView = false,
  brewPublic = false,
  entryId,
  compact = false,
}: {
  brewId: string;
  publicView?: boolean;
  brewPublic?: boolean;
  entryId?: string;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const { token, overview, request } = useBrewImagesOverview(
    brewId,
    publicView,
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [saving, setSaving] = useState(false);
  const uploader = useRecordImageUpload({
    recordId: brewId,
    target: "brews",
    token,
    entryId,
    onUploaded: () => overview.refetch(),
  });
  const { error, setError, showError, fileInput } = uploader;
  const busy = saving || uploader.busy;
  const photoTrigger = useRef<HTMLButtonElement | null>(null);
  const visibleImages = (overview.data?.images ?? []).filter(
    (image) => !entryId || image.entry_id === entryId,
  );
  const selected = overview.data?.images.find(
    (image) => image.id === selectedId,
  );
  // Only the owner's open photo needs the cover state; galleries stay one request.
  const { cover, setCover, refreshCover } = useRecordCover(brewId, "brews", {
    enabled: !publicView && Boolean(selected),
  });
  const isCover = Boolean(selected) && cover.data?.image?.id === selected?.id;
  async function act(action: () => Promise<unknown>) {
    setSaving(true);
    setError(null);
    try {
      await action();
    } catch (cause) {
      showError(cause);
    } finally {
      setSaving(false);
    }
  }
  const saveCaption = () =>
    act(async () => {
      if (!selected) return;
      await request(`/api/brews/${brewId}/images/${selected.id}`, {
        method: "PATCH",
        body: JSON.stringify({ caption }),
      });
      await overview.refetch();
    });
  const remove = () =>
    act(async () => {
      if (!selected) return;
      await request(`/api/brews/${brewId}/images/${selected.id}`, {
        method: "DELETE",
      });
      setSelectedId(null);
      await overview.refetch();
      // Deleting the selected photo clears the cover server-side.
      if (isCover) await refreshCover();
    });
  if (publicView && compact && overview.isSuccess && !visibleImages.length)
    return null;
  return (
    <section
      aria-label={t("brewImages.title")}
      className={
        compact
          ? "space-y-2 pt-2"
          : "space-y-4 rounded-xl border border-border bg-card p-4 sm:p-6"
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        {!compact && (
          <h2 className="text-xl font-semibold">{t("brewImages.title")}</h2>
        )}
        {!publicView && overview.data?.can_upload && (
          <LoadingButton
            loading={uploader.busy}
            loadingText={t("brewImages.processing")}
            variant={compact ? "outline" : "default"}
            size={compact ? "sm" : "default"}
            onClick={() => fileInput.current?.click()}
            disabled={busy || overview.data.images.length >= limits.perBrew}
          >
            {t("brewImages.add")}
          </LoadingButton>
        )}
      </div>
      {!publicView && (
        <>
          <Label
            htmlFor={`brew-photo-${brewId}-${entryId ?? "gallery"}`}
            className="sr-only"
          >
            {t("brewImages.add")}
          </Label>
          <Input
            ref={fileInput}
            id={`brew-photo-${brewId}-${entryId ?? "gallery"}`}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            disabled={busy || !overview.data?.can_upload}
            onChange={(event) => {
              void uploader.selectFile(event.target.files?.[0]);
            }}
          />
          {!compact && (
            <p className="text-sm text-muted-foreground">
              {t("brewImages.limits")}
            </p>
          )}
          {!compact && overview.data && (
            <p className="text-sm text-muted-foreground">
              {t("brewImages.usage", {
                used: (overview.data.used_bytes / 1024 / 1024).toFixed(1),
              })}
            </p>
          )}
          {!compact && overview.data && !overview.data.can_upload && (
            <p className="text-sm text-muted-foreground">
              {t("brewImages.unavailable")}
            </p>
          )}
          {!compact && brewPublic && (
            <p className="text-sm text-muted-foreground">
              {t("brewImages.publicNotice")}
            </p>
          )}
        </>
      )}
      {uploader.progress !== null && (
        <BrewImageUploadProgress value={uploader.progress} />
      )}
      {error && !selected && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {uploader.pending && !busy && (
        <Button
          variant="outline"
          onClick={() => {
            void uploader.retry();
          }}
        >
          {t("brewImages.retryUpload")}
        </Button>
      )}
      {overview.isPending && overview.fetchStatus !== "idle" && (
        <div
          role="status"
          aria-label={t("brewImages.loading")}
          className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
        >
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} className="aspect-square w-full" />
          ))}
        </div>
      )}
      {overview.isError && (
        <Button
          variant="outline"
          onClick={() => {
            void overview.refetch();
          }}
        >
          {t("brewImages.retry")}
        </Button>
      )}
      {!compact && overview.data && !visibleImages.length && (
        <p className="text-sm text-muted-foreground">{t("brewImages.empty")}</p>
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {visibleImages.map((image) => (
          <div key={image.id} className="min-w-0 space-y-1">
            <Photo
              image={image}
              brewId={brewId}
              publicView={publicView}
              request={request}
              onOpen={(event) => {
                photoTrigger.current = event.currentTarget;
                setSelectedId(image.id);
                setCaption(image.caption);
                setError(null);
              }}
            />
            {!compact && (
              <p className="text-xs text-muted-foreground">
                {image.entry_hidden || !image.entry_id
                  ? t("brewImages.brewPhoto")
                  : image.entry_title || t("brewImages.entryPhoto")}
              </p>
            )}
            {image.caption && (
              <p className="break-words text-sm">{image.caption}</p>
            )}
          </div>
        ))}
      </div>
      <Dialog
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open && !busy) setSelectedId(null);
        }}
      >
        <DialogContent
          className="max-h-[95dvh] overflow-y-auto sm:max-w-3xl"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            requestAnimationFrame(() => photoTrigger.current?.focus());
          }}
        >
          <DialogHeader>
            <DialogTitle>{t("brewImages.photoAlt")}</DialogTitle>
            <DialogDescription>
              {publicView
                ? t("brewImages.publicDescription")
                : t("brewImages.editDescription")}
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <Photo
              key={selected.id}
              image={selected}
              brewId={brewId}
              publicView={publicView}
              full
              request={request}
            />
          )}
          {publicView ? (
            <p className="break-words">{selected?.caption}</p>
          ) : (
            <>
              {(isCover || cover.data?.can_set) && (
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy || isCover}
                    onClick={() => {
                      if (selected && !isCover)
                        void act(() => setCover(selected.id));
                    }}
                  >
                    {t(isCover ? "coverImages.selected" : "coverImages.usePhoto")}
                  </Button>
                  {isCover && (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      onClick={() => void act(() => setCover(null))}
                    >
                      {t("coverImages.remove")}
                    </Button>
                  )}
                </div>
              )}
              <Label htmlFor="brew-photo-caption">
                {t("brewImages.caption")}
              </Label>
              <Textarea
                id="brew-photo-caption"
                value={caption}
                maxLength={limits.captionLength}
                disabled={busy}
                onChange={(event) => setCaption(event.target.value)}
              />
              <div className="flex flex-wrap justify-between gap-3">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" disabled={busy}>
                      {t("brewImages.remove")}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        {t("brewImages.removeTitle")}
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        {t("brewImages.removeDescription")}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => {
                          void remove();
                        }}
                      >
                        {t("brewImages.remove")}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                <LoadingButton
                  loading={saving}
                  disabled={busy}
                  onClick={() => {
                    void saveCaption();
                  }}
                >
                  {t("brewImages.saveCaption")}
                </LoadingButton>
              </div>
              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}

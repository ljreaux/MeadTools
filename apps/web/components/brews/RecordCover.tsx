"use client";

import Link from "next/link";
import { useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ImageIcon, ImagePlus, Pencil, Trash2 } from "lucide-react";
import type { BrewImageResponse } from "@meadtools/api-contract/contracts";
import { BREW_IMAGE_LIMITS as limits } from "@meadtools/brew-domain/images";
import {
  useBrewImagesOverview,
  useRecordCover,
  useRecordImageUpload,
  type ImageTarget,
} from "@/hooks/reactQuery/useBrewImages";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { Photo } from "./BrewImages";
import { BrewImageUploadProgress } from "./BrewImageUploadProgress";

/**
 * Lists show small square thumbnails beside titles; detail pages show a
 * full-width banner. Both are center-cropped (object-cover).
 */
const sizes = {
  sm: "size-10",
  md: "size-12",
  card: "size-12 sm:size-24",
} as const;
type CoverSize = keyof typeof sizes;

const frame = "relative shrink-0 overflow-hidden rounded-md border border-border bg-muted";
const banner =
  "relative block aspect-video w-full overflow-hidden rounded-lg border border-border bg-muted sm:aspect-auto sm:h-56 lg:h-64";
const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

function Placeholder({ size, className }: { size: CoverSize; className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        frame,
        sizes[size],
        "flex items-center justify-center border-dashed bg-transparent",
        className,
      )}
    >
      <ImageIcon className="size-2/5 text-muted-foreground/50" />
    </div>
  );
}

/**
 * List thumbnail. Pass `coverId` from list data: `null` skips the request
 * entirely, so records without a cover cost nothing. Visibility is resolved by
 * the server at request time; signed URLs are never persisted and never pass
 * through the image optimizer.
 */
export function CoverThumbnail({
  id,
  target,
  publicView = false,
  size = "md",
  coverId,
  placeholder = false,
  className,
}: {
  id: string;
  target: ImageTarget;
  publicView?: boolean;
  size?: CoverSize;
  coverId?: string | null;
  /** Reserve the slot with a neutral icon when there is no cover (rows and tables). */
  placeholder?: boolean;
  className?: string;
}) {
  const { cover, request } = useRecordCover(id, target, {
    publicView,
    enabled: coverId !== null,
  });
  const image = cover.data?.image;
  if (!image) {
    // Only show a loading frame where the slot is reserved or a cover is known to exist.
    if (cover.isLoading && (placeholder || coverId))
      return <Skeleton className={cn(sizes[size], "shrink-0 rounded-md", className)} />;
    return placeholder ? <Placeholder size={size} className={className} /> : null;
  }
  return (
    <div className={cn(frame, sizes[size], className)}>
      <Photo
        key={image.id}
        image={image}
        brewId={id}
        target={target}
        publicView={publicView}
        request={request}
        compact
      />
    </div>
  );
}

function BannerImage({
  image,
  id,
  target,
  publicView,
  request,
}: {
  image: BrewImageResponse;
  id: string;
  target: ImageTarget;
  publicView: boolean;
  request: (path: string, init?: RequestInit) => Promise<unknown>;
}) {
  return (
    <Photo
      key={image.id}
      image={image}
      brewId={id}
      target={target}
      publicView={publicView}
      request={request}
      compact
      hiRes
    />
  );
}

/** Read-only detail banner; selecting it opens the uncropped photo. */
export function CoverBanner({
  id,
  target,
  publicView = false,
  coverId,
  className,
}: {
  id: string;
  target: ImageTarget;
  publicView?: boolean;
  coverId?: string | null;
  className?: string;
}) {
  const { t } = useTranslation();
  const { cover, request } = useRecordCover(id, target, {
    publicView,
    enabled: coverId !== null,
  });
  const image = cover.data?.image;
  if (!image)
    return cover.isLoading && coverId ? (
      <Skeleton className={cn(banner, "border-0", className)} />
    ) : null;
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label={t("coverImages.view")}
          className={cn(banner, "cursor-zoom-in", focusRing, className)}
        >
          <BannerImage
            image={image}
            id={id}
            target={target}
            publicView={publicView}
            request={request}
          />
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[95dvh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t("coverImages.title")}</DialogTitle>
          {image.caption ? (
            <DialogDescription className="break-words">{image.caption}</DialogDescription>
          ) : (
            <DialogDescription className="sr-only">
              {t("coverImages.view")}
            </DialogDescription>
          )}
        </DialogHeader>
        <Photo
          image={image}
          brewId={id}
          target={target}
          publicView={publicView}
          request={request}
          full
        />
      </DialogContent>
    </Dialog>
  );
}

/**
 * Owner detail banner. With a cover: the banner plus a "Change cover image"
 * button on it. Without one: a single compact "Add cover image" button, so
 * records without covers keep their existing layout.
 */
export function EditableCover({
  id,
  target,
  recordPublic = false,
  coverId,
  className,
}: {
  id: string;
  target: ImageTarget;
  recordPublic?: boolean;
  /** The record's cover_image_id, used only to choose the loading state. */
  coverId?: string | null;
  className?: string;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const coverState = useRecordCover(id, target);
  const { cover, request } = coverState;
  const image = cover.data?.image;
  let content: ReactNode;
  if (image)
    content = (
      <div className={cn(banner, className)}>
        <BannerImage
          image={image}
          id={id}
          target={target}
          publicView={false}
          request={request}
        />
        <DialogTrigger asChild>
          <Button
            ref={trigger}
            variant="secondary"
            size="sm"
            className="absolute bottom-3 right-3 bg-background/85 shadow-sm backdrop-blur hover:bg-background"
          >
            <Pencil aria-hidden="true" />
            {t("coverImages.change")}
          </Button>
        </DialogTrigger>
      </div>
    );
  else if (cover.isLoading)
    content = coverId ? <Skeleton className={cn(banner, "border-0", className)} /> : null;
  else
    content = (
      <DialogTrigger asChild>
        <Button
          ref={trigger}
          variant="outline"
          size="sm"
          // Block-level so it never shares a line with inline siblings (e.g. ratings).
          className={cn("flex w-fit border-dashed text-muted-foreground", className)}
        >
          <ImagePlus aria-hidden="true" />
          {t("coverImages.add")}
        </Button>
      </DialogTrigger>
    );
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {content}
      <DialogContent
        className="max-h-[90dvh] overflow-y-auto sm:max-w-xl"
        // Photos load after opening; start on the dialog, not on "Remove cover".
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          (event.currentTarget as HTMLElement | null)?.focus();
        }}
        // The trigger swaps between "Add" and "Change" when the cover changes.
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          requestAnimationFrame(() => trigger.current?.focus());
        }}
      >
        {open && (
          <CoverPicker
            id={id}
            target={target}
            recordPublic={recordPublic}
            coverState={coverState}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function CoverPicker({
  id,
  target,
  recordPublic,
  coverState,
}: {
  id: string;
  target: ImageTarget;
  recordPublic: boolean;
  coverState: ReturnType<typeof useRecordCover>;
}) {
  const { t } = useTranslation();
  const { cover, setCover, refreshCover } = coverState;
  const { overview, request, token } = useBrewImagesOverview(id, false, target);
  const [saving, setSaving] = useState(false);
  const uploader = useRecordImageUpload({
    recordId: id,
    target,
    token,
    // Uploading from the picker always selects the new photo.
    setAsCover: true,
    onUploaded: async () => {
      await Promise.all([overview.refetch(), refreshCover()]);
    },
  });
  const { error, setError, showError, fileInput } = uploader;
  const busy = saving || uploader.busy;
  const canSet = Boolean(cover.data?.can_set);
  const currentId = cover.data?.image?.id ?? null;
  const images = overview.data?.images ?? [];
  const canUpload =
    canSet && Boolean(overview.data?.can_upload) && images.length < limits.perBrew;
  const inputId = `cover-upload-${target}-${id}`;

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
  const deletePhoto = (imageId: string) =>
    act(async () => {
      await request(`/api/${target}/${id}/images/${imageId}`, {
        method: "DELETE",
      });
      await Promise.all([overview.refetch(), refreshCover()]);
    });

  return (
    <div className="space-y-4">
      <DialogHeader>
        <DialogTitle>{t("coverImages.title")}</DialogTitle>
        <DialogDescription>
          {t(
            target === "recipes"
              ? "coverImages.recipeDescription"
              : "coverImages.brewDescription",
          )}
          {recordPublic ? ` ${t("coverImages.publicNotice")}` : ""}
        </DialogDescription>
      </DialogHeader>

      {cover.data && !canSet && (
        <p className="rounded-md border border-border bg-muted/50 p-3 text-sm text-muted-foreground">
          {t("coverImages.premiumRequired")}{" "}
          <Link href="/account/premium" className="text-foreground underline underline-offset-4">
            {t("coverImages.premiumLink")}
          </Link>
        </p>
      )}

      {overview.isPending || cover.isPending ? (
        <div
          role="status"
          aria-label={t("brewImages.loading")}
          className="grid grid-cols-3 gap-2 sm:grid-cols-4"
        >
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} className="aspect-square w-full" />
          ))}
        </div>
      ) : overview.isError || cover.isError ? (
        <Button
          variant="outline"
          onClick={() => {
            void overview.refetch();
            void cover.refetch();
          }}
        >
          {t("brewImages.retry")}
        </Button>
      ) : images.length ? (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4" aria-label={t("brewImages.title")}>
          {images.map((image, index) => (
            <CoverOption
              key={image.id}
              image={image}
              index={index}
              id={id}
              target={target}
              request={request}
              current={image.id === currentId}
              disabled={busy || !canSet}
              onSelect={() => void act(() => setCover(image.id))}
              onDelete={
                target === "recipes" ? () => void deletePhoto(image.id) : undefined
              }
              deleteDisabled={busy}
            />
          ))}
        </ul>
      ) : (
        <p className="rounded-md border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
          {t(canUpload ? "coverImages.emptyUpload" : "brewImages.empty")}
        </p>
      )}

      {uploader.progress !== null && (
        <BrewImageUploadProgress value={uploader.progress} />
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <div className="flex flex-wrap items-center gap-2">
          {canSet && (
            <>
              <Input
                ref={fileInput}
                id={inputId}
                type="file"
                tabIndex={-1}
                aria-hidden="true"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                disabled={busy || !canUpload}
                onChange={(event) => {
                  void uploader.selectFile(event.target.files?.[0]);
                }}
              />
              <LoadingButton
                loading={uploader.busy}
                loadingText={t("brewImages.processing")}
                disabled={busy || !canUpload}
                onClick={() => fileInput.current?.click()}
              >
                <ImagePlus aria-hidden="true" />
                {t("coverImages.upload")}
              </LoadingButton>
            </>
          )}
          {uploader.pending && !busy && (
            <Button variant="outline" onClick={() => void uploader.retry()}>
              {t("brewImages.retryUpload")}
            </Button>
          )}
        </div>
        {currentId && (
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() => void act(() => setCover(null))}
          >
            {t("coverImages.remove")}
          </Button>
        )}
      </div>
      {canSet && (
        <p className="text-xs text-muted-foreground">
          {t(target === "recipes" ? "coverImages.recipeLimits" : "brewImages.limits")}
        </p>
      )}
    </div>
  );
}

function CoverOption({
  image,
  index,
  id,
  target,
  request,
  current,
  disabled,
  onSelect,
  onDelete,
  deleteDisabled,
}: {
  image: BrewImageResponse;
  index: number;
  id: string;
  target: ImageTarget;
  request: (path: string, init?: RequestInit) => Promise<unknown>;
  current: boolean;
  disabled: boolean;
  onSelect: () => void;
  onDelete?: () => void;
  deleteDisabled: boolean;
}) {
  const { t } = useTranslation();
  const name =
    image.caption ||
    (target === "brews" && image.entry_id && !image.entry_hidden && image.entry_title) ||
    t("coverImages.photoNumber", { number: index + 1 });
  return (
    <li className="relative min-w-0">
      <button
        type="button"
        aria-pressed={current}
        disabled={disabled || current}
        aria-label={
          current
            ? `${name}: ${t("coverImages.selected")}`
            : `${t("coverImages.usePhoto")}: ${name}`
        }
        title={current ? t("coverImages.selected") : t("coverImages.usePhoto")}
        onClick={onSelect}
        className={cn(
          "block aspect-square w-full overflow-hidden rounded-md border border-border bg-muted",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          "enabled:hover:border-foreground/40 disabled:cursor-default",
          current && "border-primary ring-2 ring-primary ring-offset-2 ring-offset-background",
        )}
      >
        <Photo
          image={image}
          brewId={id}
          target={target}
          publicView={false}
          request={request}
          compact
        />
      </button>
      {current && (
        <span className="pointer-events-none absolute inset-x-1 bottom-1 truncate rounded bg-background/90 px-1.5 py-0.5 text-center text-xs font-medium">
          {t("coverImages.selected")}
        </span>
      )}
      {onDelete && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="secondary"
              size="icon"
              disabled={deleteDisabled}
              className="absolute right-1 top-1 size-7 bg-background/85"
              aria-label={`${t("brewImages.remove")}: ${name}`}
              title={t("brewImages.remove")}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("brewImages.removeTitle")}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("coverImages.recipeRemoveDescription")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
              <AlertDialogAction onClick={onDelete}>
                {t("brewImages.remove")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </li>
  );
}

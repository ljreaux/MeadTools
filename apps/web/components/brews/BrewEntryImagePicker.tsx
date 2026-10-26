"use client";
import { useRef, useState } from "react";
import Image from "next/image";
import { useTranslation } from "react-i18next";
import {
  BREW_IMAGE_LIMITS as limits,
  BrewImageError,
} from "@meadtools/brew-domain/images";
import type { CreateBrewImageRequestBody } from "@meadtools/api-contract/contracts";
import { useBrewImagesOverview } from "@/hooks/reactQuery/useBrewImages";
import { prepareBrewImage } from "@/lib/brews/prepareBrewImage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingButton } from "@/components/ui/LoadingButton";

export type DraftBrewImage = CreateBrewImageRequestBody & { filename: string };
export function BrewEntryImagePicker({
  brewId,
  photos,
  onChange,
  disabled,
  onPreparingChange,
}: {
  brewId: string;
  photos: DraftBrewImage[];
  onChange: (photos: DraftBrewImage[]) => void;
  disabled?: boolean;
  onPreparingChange?: (preparing: boolean) => void;
}) {
  const { t } = useTranslation();
  const { overview } = useBrewImagesOverview(brewId);
  const fileInput = useRef<HTMLInputElement>(null);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function select(files: FileList | null) {
    if (!files) return;
    setPreparing(true);
    onPreparingChange?.(true);
    setError(null);
    try {
      if (
        photos.length + files.length + (overview.data?.images.length ?? 0) >
        limits.perBrew
      )
        throw new BrewImageError("BREW_IMAGE_LIMIT");
      const next: DraftBrewImage[] = [];
      for (const file of Array.from(files))
        next.push({
          ...(await prepareBrewImage(file)),
          filename: file.name,
          operation_id: crypto.randomUUID(),
          caption: "",
        });
      onChange([...photos, ...next]);
    } catch (cause) {
      setError(
        t(
          `brewImages.errors.${cause instanceof BrewImageError ? cause.code : "INVALID_IMAGE"}`,
        ),
      );
    } finally {
      setPreparing(false);
      onPreparingChange?.(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }
  if (!overview.data?.can_upload) return null;
  return (
    <div className="space-y-2 rounded-md border border-border p-3">
      <Input
        ref={fileInput}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        disabled={disabled || preparing}
        onChange={(event) => {
          void select(event.target.files);
        }}
        aria-label={t("brewImages.addToEntry")}
      />
      <LoadingButton
        type="button"
        variant="outline"
        loading={preparing}
        disabled={disabled}
        onClick={() => fileInput.current?.click()}
      >
        {t("brewImages.addToEntry")}
      </LoadingButton>
      <p className="text-xs text-muted-foreground">
        {t("brewImages.entryPickerHelp")}
      </p>
      {photos.map((photo) => (
        <div
          key={photo.operation_id}
          className="flex items-center gap-3 rounded-md border border-border p-2 text-sm"
        >
          <Image
            unoptimized
            src={`data:${photo.content_type};base64,${photo.base64}`}
            alt={t("brewImages.selectedPhotoAlt", { name: photo.filename })}
            width={64}
            height={64}
            className="h-16 w-16 shrink-0 rounded-md object-cover"
          />
          <span className="min-w-0 flex-1 break-all">{photo.filename}</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled || preparing}
            onClick={() =>
              onChange(
                photos.filter(
                  (item) => item.operation_id !== photo.operation_id,
                ),
              )
            }
            aria-label={t("brewImages.removeSelected", {
              name: photo.filename,
            })}
          >
            {t("remove", "Remove")}
          </Button>
        </div>
      ))}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

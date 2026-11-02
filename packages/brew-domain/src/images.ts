/** Provider-independent product limits shared by web and future clients. */
export const BREW_IMAGE_LIMITS = {
  perBrew: 20,
  accountBytes: 250 * 1024 * 1024,
  originalBytes: 20 * 1024 * 1024,
  uploadBytes: 3 * 1024 * 1024,
  displayBytes: 1024 * 1024,
  thumbnailBytes: 64 * 1024,
  displayEdge: 1600,
  thumbnailEdge: 320,
  maxPixels: 40_000_000,
  captionLength: 500,
  urlSeconds: 60,
  attemptsPerDay: 100,
} as const;

export type BrewImageErrorCode =
  | "INVALID_IMAGE"
  | "IMAGE_TOO_LARGE"
  | "QUOTA_EXCEEDED"
  | "BREW_IMAGE_LIMIT"
  | "PREMIUM_REQUIRED"
  | "NOT_FOUND"
  | "UPLOAD_IN_PROGRESS"
  | "OPERATION_CONFLICT"
  | "UPLOAD_FAILED"
  | "STORAGE_UNAVAILABLE"
  | "RATE_LIMITED";

export class BrewImageError extends Error {
  constructor(readonly code: BrewImageErrorCode) {
    super(code);
  }
}

export function checkBrewImageAllowance(input: {
  usedBytes: number;
  brewCount: number;
  pendingCount: number;
  dailyAttempts: number;
}) {
  const reservation =
    BREW_IMAGE_LIMITS.displayBytes + BREW_IMAGE_LIMITS.thumbnailBytes;
  if (input.dailyAttempts >= BREW_IMAGE_LIMITS.attemptsPerDay)
    throw new BrewImageError("RATE_LIMITED");
  if (input.pendingCount >= 2) throw new BrewImageError("UPLOAD_IN_PROGRESS");
  if (input.brewCount >= BREW_IMAGE_LIMITS.perBrew)
    throw new BrewImageError("BREW_IMAGE_LIMIT");
  if (input.usedBytes + reservation > BREW_IMAGE_LIMITS.accountBytes)
    throw new BrewImageError("QUOTA_EXCEEDED");
  return reservation;
}

export function canReadBrewImage(input: {
  activeOwner: boolean;
  ownsBrew: boolean;
  brewPublic: boolean;
  recipePublic: boolean;
}) {
  return (
    input.activeOwner &&
    (input.ownsBrew || (input.brewPublic && input.recipePublic))
  );
}

/** Explicit allowlist so storage credentials and object keys cannot enter a view. */
export function projectBrewImage(image: {
  id: string;
  caption: string;
  width: number;
  height: number;
  size_bytes: number;
  created_at: Date | string;
  entry?: {
    id: string;
    title: string | null;
    datetime: Date | string;
    data: unknown;
  } | null;
}) {
  return {
    id: image.id,
    caption: image.caption,
    entry_id: image.entry?.id ?? null,
    entry_title: image.entry?.title ?? null,
    entry_datetime: image.entry
      ? typeof image.entry.datetime === "string"
        ? image.entry.datetime
        : image.entry.datetime.toISOString()
      : null,
    entry_hidden: Boolean(
      (image.entry?.data as { hidden?: boolean } | null)?.hidden,
    ),
    width: image.width,
    height: image.height,
    size_bytes: image.size_bytes,
    created_at:
      typeof image.created_at === "string"
        ? image.created_at
        : image.created_at.toISOString(),
  };
}

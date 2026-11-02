import "server-only";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  BREW_IMAGE_LIMITS,
  BrewImageError,
} from "@meadtools/brew-domain/images";

export interface BrewImageStorage {
  put(key: string, bytes: Buffer): Promise<void>;
  remove(key: string): Promise<void>;
  signedRead(key: string): Promise<string>;
}

export function brewImageStorageEnvironment() {
  return process.env.VERCEL_ENV === "production"
    ? "production"
    : process.env.VERCEL_ENV === "preview"
      ? "preview"
      : "development";
}

export function isBrewImageStorageConfigured() {
  return [
    "R2_ACCOUNT_ID",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "R2_BUCKET",
  ].every((key) => Boolean(process.env[key]));
}

/** Lazy initialization permits builds before storage is connected. */
export function createR2ImageStorage(): BrewImageStorage {
  if (!isBrewImageStorageConfigured())
    throw new BrewImageError("STORAGE_UNAVAILABLE");
  const environment = brewImageStorageEnvironment();
  const bucket = process.env.R2_BUCKET!;
  // Deployment isolation is deliberate: local/Preview credentials must never target production.
  const expected =
    environment === "production"
      ? "meadtools-brew-images-production"
      : "meadtools-brew-images-nonproduction";
  if (bucket !== expected) throw new BrewImageError("STORAGE_UNAVAILABLE");
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
    maxAttempts: 2,
  });
  function checkKey(key: string) {
    // The bucket is shared by local/Preview, but their object namespaces are not.
    if (!key.startsWith(`${environment}/brews/`))
      throw new BrewImageError("STORAGE_UNAVAILABLE");
  }
  return {
    async put(key, bytes) {
      checkKey(key);
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: bytes,
          ContentType: "image/webp",
          CacheControl: "private, no-store",
          ContentDisposition: "inline",
        }),
        { abortSignal: AbortSignal.timeout(25_000) },
      );
    },
    async remove(key) {
      checkKey(key);
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }), {
        abortSignal: AbortSignal.timeout(10_000),
      });
    },
    async signedRead(key) {
      checkKey(key);
      return getSignedUrl(
        client,
        new GetObjectCommand({
          Bucket: bucket,
          Key: key,
          ResponseCacheControl: "private, no-store",
          ResponseContentType: "image/webp",
        }),
        { expiresIn: BREW_IMAGE_LIMITS.urlSeconds },
      );
    },
  };
}

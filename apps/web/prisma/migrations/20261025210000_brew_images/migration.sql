CREATE TABLE "brew_images" (
  "id" UUID NOT NULL PRIMARY KEY,
  "brew_id" UUID,
  "original_brew_id" UUID NOT NULL,
  "entry_id" UUID,
  "original_entry_id" UUID,
  "user_id" INTEGER NOT NULL,
  "status" VARCHAR(16) NOT NULL,
  "request_hash" VARCHAR(64) NOT NULL,
  "image_key" TEXT NOT NULL,
  "thumbnail_key" TEXT NOT NULL,
  "caption" VARCHAR(500) NOT NULL DEFAULT '',
  "width" INTEGER NOT NULL DEFAULT 0,
  "height" INTEGER NOT NULL DEFAULT 0,
  "size_bytes" INTEGER NOT NULL DEFAULT 0,
  "reserved_bytes" INTEGER NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 1,
  "removed" BOOLEAN NOT NULL DEFAULT false,
  "cleanup_after" TIMESTAMPTZ(6) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "brew_images_brew_id_fkey" FOREIGN KEY ("brew_id") REFERENCES "brews"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "brew_images_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "brew_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "brew_images_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE CASCADE,
  CONSTRAINT "brew_images_status_check" CHECK ("status" IN ('pending','ready','deleting','deleted','failed')),
  CONSTRAINT "brew_images_bytes_check" CHECK ("size_bytes" >= 0 AND "reserved_bytes" >= 0 AND "attempts" > 0)
);
CREATE INDEX "brew_images_user_id_status_idx" ON "brew_images"("user_id", "status");
CREATE INDEX "brew_images_brew_id_status_idx" ON "brew_images"("brew_id", "status");
CREATE INDEX "brew_images_status_cleanup_after_idx" ON "brew_images"("status", "cleanup_after");
CREATE INDEX "brew_images_entry_id_status_idx" ON "brew_images"("entry_id", "status");

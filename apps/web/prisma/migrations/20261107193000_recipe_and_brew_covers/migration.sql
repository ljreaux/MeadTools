-- Reuse the durable attachment queue and account allowance for recipe photos.
ALTER TABLE "brew_images" ALTER COLUMN "original_brew_id" DROP NOT NULL;
ALTER TABLE "brew_images" ADD COLUMN "recipe_id" INTEGER, ADD COLUMN "original_recipe_id" INTEGER;
ALTER TABLE "brew_images" ADD CONSTRAINT "brew_images_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "brew_images_recipe_id_status_idx" ON "brew_images"("recipe_id", "status");
-- Historical parent IDs distinguish deleted recipe photos from deleted brew photos.
ALTER TABLE "brew_images" ADD CONSTRAINT "brew_images_one_original_parent" CHECK (("original_brew_id" IS NOT NULL)::int + ("original_recipe_id" IS NOT NULL)::int = 1);
ALTER TABLE "brews" ADD COLUMN "cover_image_id" UUID;
ALTER TABLE "recipes" ADD COLUMN "cover_image_id" UUID;
ALTER TABLE "brews" ADD CONSTRAINT "brews_cover_image_id_fkey" FOREIGN KEY ("cover_image_id") REFERENCES "brew_images"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_cover_image_id_fkey" FOREIGN KEY ("cover_image_id") REFERENCES "brew_images"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "brews_cover_image_id_idx" ON "brews"("cover_image_id");
CREATE INDEX "recipes_cover_image_id_idx" ON "recipes"("cover_image_id");

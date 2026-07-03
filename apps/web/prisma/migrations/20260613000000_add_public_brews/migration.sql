ALTER TABLE "brews"
ADD COLUMN "public" BOOLEAN NOT NULL DEFAULT false;

UPDATE "brews"
SET "public" = false
FROM "recipes"
WHERE "brews"."recipe_id" = "recipes"."id"
  AND "recipes"."private" = true;

-- CreateEnum
CREATE TYPE "brew_entry_type" AS ENUM ('NOTE', 'GRAVITY', 'TEMPERATURE', 'ADDITION', 'NUTRIENT', 'RACKING', 'STABILIZATION', 'BACKSWEETENING', 'PACKAGING', 'TASTING', 'STAGE_CHANGE', 'ISSUE');

-- CreateEnum
CREATE TYPE "brew_stage" AS ENUM ('PLANNED', 'PRIMARY', 'SECONDARY', 'BULK_AGE', 'STABILIZED', 'BACKSWEETENED', 'PACKAGED', 'COMPLETE');

-- AlterTable
ALTER TABLE "brews" ADD COLUMN     "batch_number" INTEGER,
ADD COLUMN     "current_volume_liters" REAL,
ADD COLUMN     "recipe_snapshot" JSONB,
ADD COLUMN     "stage" "brew_stage" NOT NULL DEFAULT 'PLANNED';

-- CreateTable
CREATE TABLE "brew_entries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "brew_id" UUID NOT NULL,
    "user_id" INTEGER,
    "datetime" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" "brew_entry_type" NOT NULL,
    "title" TEXT,
    "note" TEXT,
    "gravity" REAL,
    "temperature" REAL,
    "temp_units" "temp_units",
    "data" JSONB,

    CONSTRAINT "brew_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "brew_entries_brew_id_datetime_idx" ON "brew_entries"("brew_id", "datetime");

-- CreateIndex
CREATE INDEX "brew_entries_brew_id_type_idx" ON "brew_entries"("brew_id", "type");

-- CreateIndex
CREATE INDEX "brew_entries_user_id_datetime_idx" ON "brew_entries"("user_id", "datetime");

-- CreateIndex
CREATE INDEX "brews_user_id_start_date_idx" ON "brews"("user_id", "start_date");

-- CreateIndex
CREATE INDEX "brews_recipe_id_idx" ON "brews"("recipe_id");

-- AddForeignKey
ALTER TABLE "brew_entries" ADD CONSTRAINT "brew_entries_brew_id_fkey" FOREIGN KEY ("brew_id") REFERENCES "brews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brew_entries" ADD CONSTRAINT "brew_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

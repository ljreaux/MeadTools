CREATE TYPE "gravity_unit" AS ENUM ('SG', 'BRIX');

ALTER TABLE "brews"
ADD COLUMN "gravity_unit_preference" "gravity_unit" NOT NULL DEFAULT 'SG';

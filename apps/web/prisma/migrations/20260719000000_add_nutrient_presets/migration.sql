-- CreateTable
CREATE TABLE "nutrient_presets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "yan_ppm_per_gpl" DOUBLE PRECISION NOT NULL,
    "max_gpl" DOUBLE PRECISION,
    "organic_multiplier" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "nutrient_presets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "nutrient_presets_name_key" ON "nutrient_presets"("name");

-- Seed curated Other Nutrient presets in every environment.
INSERT INTO "nutrient_presets" ("id", "name", "yan_ppm_per_gpl", "max_gpl", "organic_multiplier")
VALUES
    (gen_random_uuid(), 'Wyeast Wine Nutrient Blend', 129, NULL, false),
    (gen_random_uuid(), 'Boiled Bread Yeast (BBY)', 13.333333333333334, 7.5, true),
    (gen_random_uuid(), 'Mangrove Jack''s Mead Yeast Nutrient', 40, NULL, true),
    (gen_random_uuid(), 'Mangrove Jack''s Wine Yeast Nutrient', 140, NULL, false),
    (gen_random_uuid(), 'Vinoferm Nutrivit', 144, 0.3, false)
ON CONFLICT ("name") DO NOTHING;

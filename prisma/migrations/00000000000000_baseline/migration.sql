-- CreateEnum
CREATE TYPE "temp_units" AS ENUM ('F', 'C', 'K');

-- CreateEnum
CREATE TYPE "additive_unit" AS ENUM ('g', 'ml', 'tsp', 'oz', 'units', 'mg', 'kg', 'lbs', 'liters', 'fl oz', 'quarts', 'gal', 'tbsp');

-- CreateTable
CREATE TABLE "brews" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "start_date" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "end_date" TIMESTAMPTZ(6),
    "user_id" INTEGER,
    "latest_gravity" REAL,
    "recipe_id" INTEGER,
    "name" TEXT,
    "requested_email_alerts" BOOLEAN DEFAULT false,
    "sb_alert_sent" BOOLEAN DEFAULT false,
    "fg_alert_sent" BOOLEAN DEFAULT false,

    CONSTRAINT "brews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devices" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "device_name" TEXT,
    "recipe_id" INTEGER,
    "user_id" INTEGER NOT NULL,
    "coefficients" REAL[] DEFAULT ARRAY[]::REAL[],
    "brew_id" UUID,

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingredients" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "sugar_content" DECIMAL NOT NULL,
    "water_content" DECIMAL NOT NULL,
    "category" VARCHAR(255) NOT NULL,

    CONSTRAINT "ingredients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "datetime" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "angle" REAL NOT NULL,
    "temperature" REAL NOT NULL,
    "temp_units" "temp_units" NOT NULL,
    "battery" REAL NOT NULL,
    "gravity" REAL NOT NULL,
    "interval" INTEGER NOT NULL,
    "calculated_gravity" REAL,
    "device_id" UUID,
    "brew_id" UUID,

    CONSTRAINT "logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipes" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "name" TEXT NOT NULL,
    "recipeData" TEXT NOT NULL,
    "yanFromSource" TEXT,
    "yanContribution" TEXT NOT NULL,
    "nutrientData" TEXT NOT NULL,
    "advanced" BOOLEAN NOT NULL,
    "nuteInfo" TEXT,
    "primaryNotes" TEXT[],
    "secondaryNotes" TEXT[],
    "private" BOOLEAN NOT NULL DEFAULT false,
    "lastActivityEmailAt" TIMESTAMPTZ(6),
    "activityEmailsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "dataV2" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "recipes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password" VARCHAR(255),
    "google_id" VARCHAR(255),
    "role" VARCHAR(255) DEFAULT 'user',
    "hydro_token" TEXT,
    "public_username" VARCHAR(50),
    "google_avatar_url" TEXT,
    "show_google_avatar" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "name" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "yeasts" (
    "id" SERIAL NOT NULL,
    "brand" VARCHAR(255) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "nitrogen_requirement" VARCHAR(255) NOT NULL,
    "tolerance" DECIMAL NOT NULL,
    "low_temp" DECIMAL NOT NULL,
    "high_temp" DECIMAL NOT NULL,

    CONSTRAINT "yeasts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "additives" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT NOT NULL,
    "dosage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unit" "additive_unit" NOT NULL,

    CONSTRAINT "additives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "bjcp-ingredients" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "label" TEXT,
    "category" TEXT,
    "value" TEXT,

    CONSTRAINT "bjcp-ingredients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comments" (
    "id" UUID NOT NULL,
    "recipe_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "parent_id" UUID,
    "comment" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipe_ratings" (
    "id" UUID NOT NULL,
    "recipe_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "rating" SMALLINT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recipe_ratings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipe_daily_activity" (
    "id" SERIAL NOT NULL,
    "recipe_id" INTEGER NOT NULL,
    "summary_date" DATE NOT NULL,
    "changes" JSONB,
    "emailed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recipe_daily_activity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_hydro_token_key" ON "users"("hydro_token");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "bjcp-ingredients_label_key" ON "bjcp-ingredients"("label");

-- CreateIndex
CREATE UNIQUE INDEX "bjcp-ingredients_value_key" ON "bjcp-ingredients"("value");

-- CreateIndex
CREATE INDEX "comments_recipe_id_created_at_idx" ON "comments"("recipe_id", "created_at");

-- CreateIndex
CREATE INDEX "comments_parent_id_created_at_idx" ON "comments"("parent_id", "created_at");

-- CreateIndex
CREATE INDEX "recipe_ratings_recipe_id_idx" ON "recipe_ratings"("recipe_id");

-- CreateIndex
CREATE INDEX "recipe_ratings_user_id_idx" ON "recipe_ratings"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "recipe_ratings_recipe_id_user_id_key" ON "recipe_ratings"("recipe_id", "user_id");

-- CreateIndex
CREATE INDEX "recipe_daily_activity_recipe_id_idx" ON "recipe_daily_activity"("recipe_id");

-- CreateIndex
CREATE INDEX "recipe_daily_activity_summary_date_emailed_idx" ON "recipe_daily_activity"("summary_date", "emailed");

-- CreateIndex
CREATE UNIQUE INDEX "recipe_daily_activity_recipe_id_summary_date_key" ON "recipe_daily_activity"("recipe_id", "summary_date");

-- AddForeignKey
ALTER TABLE "brews" ADD CONSTRAINT "brews_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "brews" ADD CONSTRAINT "brews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_brew_id_fkey" FOREIGN KEY ("brew_id") REFERENCES "brews"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "logs" ADD CONSTRAINT "logs_brew_id_fkey" FOREIGN KEY ("brew_id") REFERENCES "brews"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "logs" ADD CONSTRAINT "logs_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "comments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "recipe_ratings" ADD CONSTRAINT "recipe_ratings_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_ratings" ADD CONSTRAINT "recipe_ratings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_daily_activity" ADD CONSTRAINT "recipe_daily_activity_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;


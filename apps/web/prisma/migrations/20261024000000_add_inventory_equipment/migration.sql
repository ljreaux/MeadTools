-- CreateEnum
CREATE TYPE "inventory_stock_category" AS ENUM ('honey', 'fruit', 'yeast', 'additive');

-- CreateEnum
CREATE TYPE "equipment_type" AS ENUM ('vessel', 'other');

-- CreateEnum
CREATE TYPE "inventory_quantity_unit" AS ENUM ('kg', 'g', 'mg', 'lb', 'oz', 'L', 'mL', 'gal', 'qt', 'pt', 'fl_oz', 'imp_gal', 'imp_qt', 'imp_pt', 'imp_fl_oz', 'tsp', 'tbsp', 'units');

-- CreateTable
CREATE TABLE "inventory_stock" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" INTEGER NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "category" "inventory_stock_category" NOT NULL,
    "catalog" VARCHAR(32),
    "catalog_id" VARCHAR(200),
    "quantity" DECIMAL(16,6) NOT NULL,
    "unit" "inventory_quantity_unit" NOT NULL,
    "notes" VARCHAR(5000),
    "archived_at" TIMESTAMPTZ(6),
    "reconciliation_required" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_stock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_operations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" INTEGER NOT NULL,
    "operation_key" UUID NOT NULL,
    "request_hash" VARCHAR(64) NOT NULL,
    "result" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_operations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_consumptions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" INTEGER NOT NULL,
    "stock_id" UUID NOT NULL,
    "brew_id" UUID NOT NULL,
    "entry_id" UUID NOT NULL,
    "use_key" UUID NOT NULL,
    "deducted" DECIMAL(16,6) NOT NULL,
    "unit" "inventory_quantity_unit" NOT NULL,
    "reversed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_consumptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_adjustments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" INTEGER NOT NULL,
    "stock_id" UUID NOT NULL,
    "operation_id" UUID NOT NULL,
    "consumption_id" UUID,
    "kind" VARCHAR(32) NOT NULL,
    "delta" DECIMAL(16,6) NOT NULL,
    "balance_after" DECIMAL(16,6) NOT NULL,
    "unit" "inventory_quantity_unit" NOT NULL,
    "note" VARCHAR(5000),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" INTEGER NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "type" "equipment_type" NOT NULL,
    "capacity" DECIMAL(16,6),
    "capacity_unit" "inventory_quantity_unit",
    "notes" VARCHAR(5000),
    "current_brew_id" UUID,
    "archived_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment_assignment_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" INTEGER NOT NULL,
    "equipment_id" UUID NOT NULL,
    "operation_key" UUID NOT NULL,
    "from_brew_id" UUID,
    "to_brew_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "equipment_assignment_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "inventory_stock_user_id_archived_at_idx" ON "inventory_stock"("user_id", "archived_at");

-- CreateIndex
CREATE INDEX "inventory_stock_user_id_catalog_catalog_id_idx" ON "inventory_stock"("user_id", "catalog", "catalog_id");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_stock_id_user_id_unit_key" ON "inventory_stock"("id", "user_id", "unit");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_operations_user_id_operation_key_key" ON "inventory_operations"("user_id", "operation_key");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_operations_id_user_id_key" ON "inventory_operations"("id", "user_id");

-- CreateIndex
CREATE INDEX "inventory_consumptions_user_id_brew_id_entry_id_idx" ON "inventory_consumptions"("user_id", "brew_id", "entry_id");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_consumptions_user_id_use_key_key" ON "inventory_consumptions"("user_id", "use_key");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_consumptions_id_user_id_key" ON "inventory_consumptions"("id", "user_id");

-- CreateIndex
CREATE INDEX "inventory_adjustments_user_id_stock_id_created_at_idx" ON "inventory_adjustments"("user_id", "stock_id", "created_at");

-- CreateIndex
CREATE INDEX "inventory_adjustments_consumption_id_idx" ON "inventory_adjustments"("consumption_id");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_adjustments_operation_id_stock_id_key" ON "inventory_adjustments"("operation_id", "stock_id");

-- CreateIndex
CREATE INDEX "equipment_user_id_archived_at_idx" ON "equipment"("user_id", "archived_at");

-- CreateIndex
CREATE INDEX "equipment_current_brew_id_user_id_idx" ON "equipment"("current_brew_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "equipment_id_user_id_key" ON "equipment"("id", "user_id");

-- CreateIndex
CREATE INDEX "equipment_assignment_events_user_id_equipment_id_created_at_idx" ON "equipment_assignment_events"("user_id", "equipment_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "equipment_assignment_events_user_id_operation_key_equipment_key" ON "equipment_assignment_events"("user_id", "operation_key", "equipment_id");

-- CreateIndex
CREATE UNIQUE INDEX "brews_id_user_id_key" ON "brews"("id", "user_id");

-- AddForeignKey
ALTER TABLE "inventory_stock" ADD CONSTRAINT "inventory_stock_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_operations" ADD CONSTRAINT "inventory_operations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_consumptions" ADD CONSTRAINT "inventory_consumptions_stock_id_user_id_unit_fkey" FOREIGN KEY ("stock_id", "user_id", "unit") REFERENCES "inventory_stock"("id", "user_id", "unit") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "inventory_adjustments" ADD CONSTRAINT "inventory_adjustments_stock_id_user_id_unit_fkey" FOREIGN KEY ("stock_id", "user_id", "unit") REFERENCES "inventory_stock"("id", "user_id", "unit") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "inventory_adjustments" ADD CONSTRAINT "inventory_adjustments_operation_id_user_id_fkey" FOREIGN KEY ("operation_id", "user_id") REFERENCES "inventory_operations"("id", "user_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "inventory_adjustments" ADD CONSTRAINT "inventory_adjustments_consumption_id_user_id_fkey" FOREIGN KEY ("consumption_id", "user_id") REFERENCES "inventory_consumptions"("id", "user_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_current_brew_id_user_id_fkey" FOREIGN KEY ("current_brew_id", "user_id") REFERENCES "brews"("id", "user_id") ON DELETE NO ACTION ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "equipment_assignment_events" ADD CONSTRAINT "equipment_assignment_events_equipment_id_user_id_fkey" FOREIGN KEY ("equipment_id", "user_id") REFERENCES "equipment"("id", "user_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Prisma does not express CHECK constraints. Keep these guards alongside the
-- generated migration; local db:push still relies on the shared input schemas.
ALTER TABLE "inventory_stock"
  ADD CONSTRAINT "inventory_stock_quantity_check"
    CHECK ("quantity" >= 0 AND "quantity" <= 1000000000),
  ADD CONSTRAINT "inventory_stock_name_check" CHECK (length(btrim("name")) > 0),
  ADD CONSTRAINT "inventory_stock_catalog_check" CHECK (
    ("catalog" IS NULL AND "catalog_id" IS NULL) OR
    ("catalog" IS NOT NULL AND "catalog_id" IS NOT NULL AND
     "catalog" IN ('ingredient', 'yeast', 'additive', 'nutrient') AND
     length(btrim("catalog_id")) > 0)
  );

ALTER TABLE "inventory_operations"
  ADD CONSTRAINT "inventory_operations_request_hash_check"
    CHECK ("request_hash" ~ '^[0-9a-f]{64}$');

ALTER TABLE "inventory_consumptions"
  ADD CONSTRAINT "inventory_consumptions_deducted_check"
    CHECK ("deducted" >= 0 AND "deducted" <= 1000000000);

ALTER TABLE "inventory_adjustments"
  ADD CONSTRAINT "inventory_adjustments_delta_check"
    CHECK ("delta" <> 0 AND "delta" >= -1000000000 AND "delta" <= 1000000000),
  ADD CONSTRAINT "inventory_adjustments_balance_check"
    CHECK ("balance_after" >= 0 AND "balance_after" <= 1000000000),
  ADD CONSTRAINT "inventory_adjustments_kind_check" CHECK (
    ("kind" = 'receipt' AND "delta" > 0 AND "consumption_id" IS NULL) OR
    ("kind" = 'manual_use' AND "delta" < 0 AND "consumption_id" IS NULL) OR
    ("kind" = 'correction' AND "consumption_id" IS NULL) OR
    ("kind" = 'brew_use' AND "delta" < 0 AND "consumption_id" IS NOT NULL) OR
    ("kind" = 'usage_correction' AND "consumption_id" IS NOT NULL) OR
    ("kind" = 'usage_removal' AND "delta" > 0 AND "consumption_id" IS NOT NULL)
  );

ALTER TABLE "equipment"
  ADD CONSTRAINT "equipment_name_check" CHECK (length(btrim("name")) > 0),
  ADD CONSTRAINT "equipment_capacity_check" CHECK (
    ("capacity" IS NULL AND "capacity_unit" IS NULL) OR
    ("type" = 'vessel' AND "capacity" IS NOT NULL AND "capacity_unit" IS NOT NULL AND
     "capacity" > 0 AND "capacity" <= 1000000000 AND
     "capacity_unit" IN ('L', 'mL', 'gal', 'qt', 'pt', 'fl_oz',
       'imp_gal', 'imp_qt', 'imp_pt', 'imp_fl_oz', 'tsp', 'tbsp'))
  ),
  ADD CONSTRAINT "equipment_occupancy_check" CHECK (
    "current_brew_id" IS NULL OR ("type" = 'vessel' AND "archived_at" IS NULL)
  );

ALTER TABLE "equipment_assignment_events"
  ADD CONSTRAINT "equipment_assignment_events_changed_check"
    CHECK ("from_brew_id" IS DISTINCT FROM "to_brew_id");


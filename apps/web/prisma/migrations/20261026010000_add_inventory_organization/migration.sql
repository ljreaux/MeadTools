-- AlterTable
ALTER TABLE "inventory_stock" ADD COLUMN     "storage_version" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "inventory_labels" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" INTEGER NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "archived_at" TIMESTAMPTZ(6),

    CONSTRAINT "inventory_labels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_label_links" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" INTEGER NOT NULL,
    "label_id" UUID NOT NULL,
    "stock_id" UUID,
    "mead_id" UUID,

    CONSTRAINT "inventory_label_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_locations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" INTEGER NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "parent_id" UUID,
    "version" INTEGER NOT NULL DEFAULT 0,
    "archived_at" TIMESTAMPTZ(6),

    CONSTRAINT "inventory_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_allocations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" INTEGER NOT NULL,
    "stock_id" UUID NOT NULL,
    "unit" "inventory_quantity_unit" NOT NULL,
    "location_id" UUID NOT NULL,
    "position" VARCHAR(200) NOT NULL DEFAULT '',
    "quantity" DECIMAL(16,6) NOT NULL,

    CONSTRAINT "inventory_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_storage_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" INTEGER NOT NULL,
    "stock_id" UUID NOT NULL,
    "unit" "inventory_quantity_unit" NOT NULL,
    "operation_id" UUID NOT NULL,
    "location_path" VARCHAR(5000) NOT NULL,
    "position" VARCHAR(200) NOT NULL,
    "delta" DECIMAL(16,6) NOT NULL,
    "balance_after" DECIMAL(16,6) NOT NULL,
    "reason" VARCHAR(32) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_storage_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "inventory_labels_user_id_archived_at_idx" ON "inventory_labels"("user_id", "archived_at");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_labels_id_user_id_key" ON "inventory_labels"("id", "user_id");

-- CreateIndex
CREATE INDEX "inventory_label_links_user_id_idx" ON "inventory_label_links"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_label_links_label_id_stock_id_key" ON "inventory_label_links"("label_id", "stock_id");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_label_links_label_id_mead_id_key" ON "inventory_label_links"("label_id", "mead_id");

-- CreateIndex
CREATE INDEX "inventory_locations_user_id_archived_at_idx" ON "inventory_locations"("user_id", "archived_at");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_locations_id_user_id_key" ON "inventory_locations"("id", "user_id");

-- CreateIndex
CREATE INDEX "inventory_allocations_user_id_location_id_idx" ON "inventory_allocations"("user_id", "location_id");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_allocations_stock_id_location_id_position_key" ON "inventory_allocations"("stock_id", "location_id", "position");

-- CreateIndex
CREATE INDEX "inventory_storage_events_user_id_stock_id_created_at_idx" ON "inventory_storage_events"("user_id", "stock_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_stock_id_user_id_key" ON "inventory_stock"("id", "user_id");

-- AddForeignKey
ALTER TABLE "inventory_labels" ADD CONSTRAINT "inventory_labels_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_label_links" ADD CONSTRAINT "inventory_label_links_label_id_user_id_fkey" FOREIGN KEY ("label_id", "user_id") REFERENCES "inventory_labels"("id", "user_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "inventory_label_links" ADD CONSTRAINT "inventory_label_links_stock_id_user_id_fkey" FOREIGN KEY ("stock_id", "user_id") REFERENCES "inventory_stock"("id", "user_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "inventory_label_links" ADD CONSTRAINT "inventory_label_links_mead_id_user_id_fkey" FOREIGN KEY ("mead_id", "user_id") REFERENCES "inventory_meads"("id", "user_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "inventory_locations" ADD CONSTRAINT "inventory_locations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_locations" ADD CONSTRAINT "inventory_locations_parent_id_user_id_fkey" FOREIGN KEY ("parent_id", "user_id") REFERENCES "inventory_locations"("id", "user_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "inventory_allocations" ADD CONSTRAINT "inventory_allocations_stock_id_user_id_unit_fkey" FOREIGN KEY ("stock_id", "user_id", "unit") REFERENCES "inventory_stock"("id", "user_id", "unit") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "inventory_allocations" ADD CONSTRAINT "inventory_allocations_location_id_user_id_fkey" FOREIGN KEY ("location_id", "user_id") REFERENCES "inventory_locations"("id", "user_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "inventory_storage_events" ADD CONSTRAINT "inventory_storage_events_stock_id_user_id_unit_fkey" FOREIGN KEY ("stock_id", "user_id", "unit") REFERENCES "inventory_stock"("id", "user_id", "unit") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "inventory_storage_events" ADD CONSTRAINT "inventory_storage_events_operation_id_user_id_fkey" FOREIGN KEY ("operation_id", "user_id") REFERENCES "inventory_operations"("id", "user_id") ON DELETE RESTRICT ON UPDATE RESTRICT;


-- Application transactions enforce allocation totals against stock balances.
ALTER TABLE "inventory_allocations" ADD CONSTRAINT "inventory_allocation_quantity_check"
  CHECK ("quantity" > 0 AND "quantity" <= 1000000000);
ALTER TABLE "inventory_label_links" ADD CONSTRAINT "inventory_label_target_check"
  CHECK (("stock_id" IS NOT NULL)::int + ("mead_id" IS NOT NULL)::int = 1);
ALTER TABLE "inventory_locations" ADD CONSTRAINT "inventory_location_self_check" CHECK ("id" IS DISTINCT FROM "parent_id"),
  ADD CONSTRAINT "inventory_location_name_check" CHECK (length(trim("name")) > 0);
ALTER TABLE "inventory_labels" ADD CONSTRAINT "inventory_label_name_check" CHECK (length(trim("name")) > 0);
ALTER TABLE "inventory_storage_events" ADD CONSTRAINT "inventory_storage_event_quantity_check"
  CHECK ("delta" <> 0 AND "balance_after" >= 0 AND "balance_after" <= 1000000000);

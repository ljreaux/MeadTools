-- CreateTable
CREATE TABLE "inventory_bottlings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" INTEGER NOT NULL,
    "brew_id" UUID NOT NULL,
    "entry_id" UUID NOT NULL,
    "source_name" VARCHAR(200) NOT NULL,
    "source_snapshot" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "reconciliation_required" BOOLEAN NOT NULL DEFAULT false,
    "removed_at" TIMESTAMPTZ(6),

    CONSTRAINT "inventory_bottlings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_productions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" INTEGER NOT NULL,
    "bottling_id" UUID NOT NULL,
    "stock_id" UUID NOT NULL,
    "row_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "inventory_productions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "inventory_bottlings_entry_id_key" ON "inventory_bottlings"("entry_id");

-- CreateIndex
CREATE INDEX "inventory_bottlings_user_id_brew_id_idx" ON "inventory_bottlings"("user_id", "brew_id");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_bottlings_id_user_id_key" ON "inventory_bottlings"("id", "user_id");

-- CreateIndex
CREATE INDEX "inventory_productions_user_id_stock_id_idx" ON "inventory_productions"("user_id", "stock_id");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_productions_bottling_id_row_id_stock_id_key" ON "inventory_productions"("bottling_id", "row_id", "stock_id");

-- AddForeignKey
ALTER TABLE "inventory_bottlings" ADD CONSTRAINT "inventory_bottlings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_productions" ADD CONSTRAINT "inventory_productions_bottling_id_user_id_fkey" FOREIGN KEY ("bottling_id", "user_id") REFERENCES "inventory_bottlings"("id", "user_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "inventory_productions" ADD CONSTRAINT "inventory_productions_stock_id_user_id_fkey" FOREIGN KEY ("stock_id", "user_id") REFERENCES "inventory_stock"("id", "user_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Production is always counted in whole positive bottles.
ALTER TABLE "inventory_productions" ADD CONSTRAINT "inventory_production_quantity_check" CHECK ("quantity" > 0 AND "quantity" <= 1000000000);
ALTER TABLE "inventory_adjustments" DROP CONSTRAINT "inventory_adjustments_kind_check";
ALTER TABLE "inventory_adjustments" ADD CONSTRAINT "inventory_adjustments_kind_check" CHECK (
  ("kind" = 'receipt' AND "delta" > 0 AND "consumption_id" IS NULL) OR
  ("kind" = 'manual_use' AND "delta" < 0 AND "consumption_id" IS NULL) OR
  ("kind" = 'correction' AND "consumption_id" IS NULL) OR
  ("kind" = 'brew_use' AND "delta" < 0) OR
  ("kind" = 'usage_correction') OR
  ("kind" = 'usage_removal' AND "delta" > 0) OR
  ("kind" = 'bottling_output' AND "delta" > 0 AND "consumption_id" IS NULL) OR
  ("kind" = 'bottling_correction' AND "consumption_id" IS NULL)
);
-- AlterTable
ALTER TABLE "inventory_adjustments" ADD COLUMN     "bottling_id" UUID;

-- CreateIndex
CREATE INDEX "inventory_adjustments_bottling_id_idx" ON "inventory_adjustments"("bottling_id");

-- AddForeignKey
ALTER TABLE "inventory_adjustments" ADD CONSTRAINT "inventory_adjustments_bottling_id_user_id_fkey" FOREIGN KEY ("bottling_id", "user_id") REFERENCES "inventory_bottlings"("id", "user_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Server-only access: match 20261101010000_harden_server_only_database.
ALTER TABLE "inventory_bottlings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory_productions" ENABLE ROW LEVEL SECURITY;

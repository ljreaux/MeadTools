ALTER TYPE "inventory_stock_category" ADD VALUE 'mead';

CREATE TABLE "inventory_meads" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" INTEGER NOT NULL,
  "name" VARCHAR(200) NOT NULL,
  "notes" VARCHAR(5000),
  "version" INTEGER NOT NULL DEFAULT 0,
  "archived_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "inventory_meads_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "inventory_meads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "inventory_meads_name_check" CHECK (length(trim("name")) > 0)
);
CREATE UNIQUE INDEX "inventory_meads_id_user_id_key" ON "inventory_meads"("id", "user_id");
CREATE INDEX "inventory_meads_user_id_archived_at_idx" ON "inventory_meads"("user_id", "archived_at");

ALTER TABLE "inventory_stock"
  ADD COLUMN "mead_id" UUID,
  ADD COLUMN "bottle_size_liters" DECIMAL(16,6),
  ADD CONSTRAINT "inventory_stock_mead_id_user_id_fkey" FOREIGN KEY ("mead_id", "user_id") REFERENCES "inventory_meads"("id", "user_id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "inventory_stock_finished_mead_check" CHECK (
    ("category"::text = 'mead' AND "mead_id" IS NOT NULL
      AND "bottle_size_liters" IS NOT NULL AND "bottle_size_liters" > 0 AND "bottle_size_liters" <= 1000000000
      AND "unit" = 'units' AND "quantity" = trunc("quantity")
      AND "catalog" IS NULL AND "catalog_id" IS NULL)
    OR ("category"::text <> 'mead' AND "mead_id" IS NULL AND "bottle_size_liters" IS NULL)
  );
CREATE UNIQUE INDEX "inventory_stock_mead_id_bottle_size_liters_key" ON "inventory_stock"("mead_id", "bottle_size_liters");

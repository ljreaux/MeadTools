-- AlterTable
ALTER TABLE "brews" ADD COLUMN     "share_cost_summary" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "recipes" ADD COLUMN     "share_cost_summary" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "inventory_currency" CHAR(3);

-- AlterTable
ALTER TABLE "inventory_stock" ADD COLUMN     "cost_currency" CHAR(3),
ADD COLUMN     "unit_cost" DECIMAL(24,10);

-- AlterTable
ALTER TABLE "inventory_consumptions" ADD COLUMN     "cost_currency" CHAR(3),
ADD COLUMN     "cost_excluded" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "costed_at" TIMESTAMPTZ(6),
ADD COLUMN     "unit_cost" DECIMAL(24,10);

-- CreateTable
CREATE TABLE "inventory_cost_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" INTEGER NOT NULL,
    "stock_id" UUID NOT NULL,
    "unit" "inventory_quantity_unit" NOT NULL,
    "operation_id" UUID NOT NULL,
    "kind" VARCHAR(32) NOT NULL,
    "balance_before" DECIMAL(16,6) NOT NULL,
    "received" DECIMAL(16,6),
    "price_amount" DECIMAL(16,4),
    "price_currency" CHAR(3),
    "price_per_value" DECIMAL(16,6),
    "price_per_unit" "inventory_quantity_unit",
    "applied_unit_cost" DECIMAL(24,10),
    "unit_cost_before" DECIMAL(24,10),
    "currency_before" CHAR(3),
    "unit_cost_after" DECIMAL(24,10),
    "currency_after" CHAR(3),
    "note" VARCHAR(5000),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_cost_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_cost_exclusions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" INTEGER NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "name_key" VARCHAR(200) NOT NULL,
    "catalog" VARCHAR(32),
    "catalog_id" VARCHAR(200),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_cost_exclusions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "inventory_cost_events_user_id_stock_id_created_at_idx" ON "inventory_cost_events"("user_id", "stock_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_cost_events_operation_id_stock_id_key" ON "inventory_cost_events"("operation_id", "stock_id");

-- CreateIndex
CREATE INDEX "inventory_cost_exclusions_user_id_idx" ON "inventory_cost_exclusions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_cost_exclusions_user_id_name_key_key" ON "inventory_cost_exclusions"("user_id", "name_key");

-- AddForeignKey
ALTER TABLE "inventory_cost_events" ADD CONSTRAINT "inventory_cost_events_stock_id_user_id_unit_fkey" FOREIGN KEY ("stock_id", "user_id", "unit") REFERENCES "inventory_stock"("id", "user_id", "unit") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "inventory_cost_events" ADD CONSTRAINT "inventory_cost_events_operation_id_user_id_fkey" FOREIGN KEY ("operation_id", "user_id") REFERENCES "inventory_operations"("id", "user_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "inventory_cost_exclusions" ADD CONSTRAINT "inventory_cost_exclusions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Costs are unknown (null) or a non-negative amount in one ISO 4217 currency.
ALTER TABLE "users" ADD CONSTRAINT "users_inventory_currency_check" CHECK ("inventory_currency" IS NULL OR "inventory_currency" ~ '^[A-Z]{3}$');
ALTER TABLE "inventory_stock" ADD CONSTRAINT "inventory_stock_cost_check" CHECK (
  ("unit_cost" IS NULL AND "cost_currency" IS NULL)
  OR ("unit_cost" IS NOT NULL AND "unit_cost" >= 0 AND "cost_currency" ~ '^[A-Z]{3}$')
);
ALTER TABLE "inventory_consumptions" ADD CONSTRAINT "inventory_consumptions_cost_check" CHECK (
  ("unit_cost" IS NULL AND "cost_currency" IS NULL)
  OR ("unit_cost" IS NOT NULL AND "unit_cost" >= 0 AND "cost_currency" ~ '^[A-Z]{3}$' AND "costed_at" IS NOT NULL)
);
ALTER TABLE "inventory_cost_events" ADD CONSTRAINT "inventory_cost_events_kind_check" CHECK (
  ("kind" = 'receipt' AND "received" IS NOT NULL AND "received" > 0) OR
  ("kind" = 'valuation' AND "received" IS NULL AND "price_amount" IS NOT NULL)
);
ALTER TABLE "inventory_cost_events" ADD CONSTRAINT "inventory_cost_events_price_check" CHECK (
  ("price_amount" IS NULL AND "price_currency" IS NULL AND "price_per_value" IS NULL
    AND "price_per_unit" IS NULL AND "applied_unit_cost" IS NULL)
  OR ("price_amount" >= 0 AND "price_currency" ~ '^[A-Z]{3}$' AND "price_per_value" > 0
    AND "price_per_unit" IS NOT NULL AND "applied_unit_cost" >= 0)
);
ALTER TABLE "inventory_cost_events" ADD CONSTRAINT "inventory_cost_events_after_check" CHECK (
  ("unit_cost_after" IS NULL AND "currency_after" IS NULL)
  OR ("unit_cost_after" >= 0 AND "currency_after" ~ '^[A-Z]{3}$')
);

ALTER TABLE "inventory_cost_exclusions" ADD CONSTRAINT "inventory_cost_exclusions_name_check" CHECK (
  length(trim("name")) > 0 AND length("name_key") > 0
  AND (("catalog" IS NULL AND "catalog_id" IS NULL) OR ("catalog" IS NOT NULL AND "catalog_id" IS NOT NULL))
);

-- Server-only access: match 20261101010000_harden_server_only_database.
ALTER TABLE "inventory_cost_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory_cost_exclusions" ENABLE ROW LEVEL SECURITY;

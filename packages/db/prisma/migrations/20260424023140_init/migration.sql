-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "citext";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- CreateEnum
CREATE TYPE "data_quality_issue" AS ENUM ('MISSING_COST', 'MISSING_PACKAGE_SIZE', 'AMBIGUOUS_UNIT');

-- CreateEnum
CREATE TYPE "movement_type" AS ENUM ('PURCHASE', 'CONSUMPTION', 'TRANSFER_IN', 'TRANSFER_OUT', 'ADJUSTMENT', 'WASTE', 'RETURN', 'INITIAL');

-- CreateEnum
CREATE TYPE "audit_status" AS ENUM ('DRAFT', 'IN_PROGRESS', 'COUNTED', 'RECONCILED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "audit_scope_type" AS ENUM ('FULL', 'CATEGORY', 'SPOT', 'ABC_CYCLE', 'CUSTOM');

-- CreateEnum
CREATE TYPE "service_event_status" AS ENUM ('PLANNED', 'EXECUTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "tenants" (
    "id" UUID NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "display_name" VARCHAR(120) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "display_name" VARCHAR(80) NOT NULL,
    "permissions" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "email" CITEXT NOT NULL,
    "full_name" VARCHAR(120) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "mfa_enabled" BOOLEAN NOT NULL DEFAULT false,
    "mfa_secret" TEXT,
    "locale" CHAR(2) NOT NULL DEFAULT 'es',
    "last_login_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id","role_id")
);

-- CreateTable
CREATE TABLE "auth_refresh_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "replaced_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip_address" INET,
    "user_agent" TEXT,

    CONSTRAINT "auth_refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_categories" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "display_name" VARCHAR(80) NOT NULL,
    "description" TEXT,
    "parent_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "sku" VARCHAR(40) NOT NULL,
    "name" JSONB NOT NULL,
    "category_id" UUID NOT NULL,
    "base_unit" VARCHAR(8) NOT NULL,
    "package_size" DECIMAL(12,4),
    "package_cost" DECIMAL(12,4),
    "unit_cost" DECIMAL(14,6),
    "reorder_point" DECIMAL(12,4),
    "reorder_qty" DECIMAL(12,4),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "data_quality_issue" "data_quality_issue",
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_price_history" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "package_cost" DECIMAL(12,4) NOT NULL,
    "package_size" DECIMAL(12,4) NOT NULL,
    "effective_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" VARCHAR(40) NOT NULL DEFAULT 'manual',
    "created_by_id" UUID NOT NULL,

    CONSTRAINT "product_price_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipes" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "name" JSONB NOT NULL,
    "yield_qty" DECIMAL(12,4) NOT NULL DEFAULT 1,
    "yield_unit" VARCHAR(16) NOT NULL DEFAULT 'porcion',
    "instructions" TEXT,
    "cooking_temp" VARCHAR(40),
    "cooking_time" VARCHAR(40),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "recipes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipe_lines" (
    "id" UUID NOT NULL,
    "recipe_id" UUID NOT NULL,
    "product_id" UUID,
    "sub_recipe_id" UUID,
    "qty_per_portion" DECIMAL(12,4) NOT NULL,
    "unit" VARCHAR(8) NOT NULL,
    "notes" TEXT,
    "position" SMALLINT NOT NULL,

    CONSTRAINT "recipe_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menus" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "display_name" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "menus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menu_recipes" (
    "menu_id" UUID NOT NULL,
    "recipe_id" UUID NOT NULL,
    "position" SMALLINT NOT NULL,

    CONSTRAINT "menu_recipes_pkey" PRIMARY KEY ("menu_id","recipe_id")
);

-- CreateTable
CREATE TABLE "warehouses" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "display_name" VARCHAR(80) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_levels" (
    "product_id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "qty_on_hand" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "stock_levels_pkey" PRIMARY KEY ("product_id","warehouse_id")
);

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "movement_type" "movement_type" NOT NULL,
    "qty" DECIMAL(14,4) NOT NULL,
    "unit_cost" DECIMAL(14,6),
    "reference_type" VARCHAR(40),
    "reference_id" UUID,
    "notes" TEXT,
    "performed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "performed_by_id" UUID NOT NULL,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audits" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "scope_type" "audit_scope_type" NOT NULL DEFAULT 'FULL',
    "scope_filter" JSONB NOT NULL DEFAULT '{}',
    "status" "audit_status" NOT NULL DEFAULT 'DRAFT',
    "scheduled_at" TIMESTAMPTZ(6),
    "started_at" TIMESTAMPTZ(6),
    "closed_at" TIMESTAMPTZ(6),
    "conducted_by_id" UUID NOT NULL,
    "approved_by_id" UUID,
    "notes" TEXT,
    "total_variance_qty" DECIMAL(14,4),
    "total_variance_value" DECIMAL(14,2),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "audits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_counts" (
    "id" UUID NOT NULL,
    "audit_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "expected_qty" DECIMAL(14,4) NOT NULL,
    "counted_qty" DECIMAL(14,4),
    "variance_qty" DECIMAL(14,4),
    "unit_cost" DECIMAL(14,6) NOT NULL,
    "variance_value" DECIMAL(14,2),
    "reason_code" VARCHAR(40),
    "notes" TEXT,
    "counted_by_id" UUID,
    "counted_at" TIMESTAMPTZ(6),

    CONSTRAINT "audit_counts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_adjustments" (
    "id" UUID NOT NULL,
    "audit_count_id" UUID NOT NULL,
    "movement_id" UUID NOT NULL,
    "approved_by_id" UUID NOT NULL,
    "approved_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_events" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "menu_id" UUID,
    "guest_count" INTEGER NOT NULL,
    "scheduled_at" TIMESTAMPTZ(6) NOT NULL,
    "status" "service_event_status" NOT NULL DEFAULT 'PLANNED',
    "warehouse_id" UUID NOT NULL,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_event_recipes" (
    "service_event_id" UUID NOT NULL,
    "recipe_id" UUID NOT NULL,
    "portions" DECIMAL(12,4) NOT NULL,

    CONSTRAINT "service_event_recipes_pkey" PRIMARY KEY ("service_event_id","recipe_id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" UUID NOT NULL,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenant_id" UUID,
    "actor_id" UUID,
    "actor_email" CITEXT NOT NULL,
    "entity" VARCHAR(60) NOT NULL,
    "entity_id" UUID NOT NULL,
    "action" VARCHAR(20) NOT NULL,
    "before_json" JSONB,
    "after_json" JSONB,
    "diff_json" JSONB,
    "ip_address" INET,
    "user_agent" TEXT,
    "request_id" UUID,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "low_stock_alerts" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "qty_on_hand" DECIMAL(14,4) NOT NULL,
    "reorder_point" DECIMAL(14,4) NOT NULL,
    "raised_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMPTZ(6),
    "resolved_by_id" UUID,

    CONSTRAINT "low_stock_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_code_key" ON "tenants"("code");

-- CreateIndex
CREATE UNIQUE INDEX "roles_code_key" ON "roles"("code");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_tenant_id_idx" ON "users"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "auth_refresh_tokens_token_hash_key" ON "auth_refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "auth_refresh_tokens_user_id_revoked_at_idx" ON "auth_refresh_tokens"("user_id", "revoked_at");

-- CreateIndex
CREATE INDEX "product_categories_tenant_id_idx" ON "product_categories"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_categories_tenant_id_code_key" ON "product_categories"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "products_tenant_id_is_active_idx" ON "products"("tenant_id", "is_active");

-- CreateIndex
CREATE INDEX "products_category_id_idx" ON "products"("category_id");

-- CreateIndex
CREATE UNIQUE INDEX "products_tenant_id_sku_key" ON "products"("tenant_id", "sku");

-- CreateIndex
CREATE INDEX "product_price_history_product_id_effective_at_idx" ON "product_price_history"("product_id", "effective_at");

-- CreateIndex
CREATE INDEX "recipes_tenant_id_is_active_idx" ON "recipes"("tenant_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "recipes_tenant_id_code_key" ON "recipes"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "recipe_lines_recipe_id_idx" ON "recipe_lines"("recipe_id");

-- CreateIndex
CREATE INDEX "recipe_lines_product_id_idx" ON "recipe_lines"("product_id");

-- CreateIndex
CREATE INDEX "recipe_lines_sub_recipe_id_idx" ON "recipe_lines"("sub_recipe_id");

-- CreateIndex
CREATE UNIQUE INDEX "menus_tenant_id_code_key" ON "menus"("tenant_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "warehouses_tenant_id_code_key" ON "warehouses"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "stock_levels_tenant_id_idx" ON "stock_levels"("tenant_id");

-- CreateIndex
CREATE INDEX "stock_movements_tenant_id_performed_at_idx" ON "stock_movements"("tenant_id", "performed_at" DESC);

-- CreateIndex
CREATE INDEX "stock_movements_product_id_performed_at_idx" ON "stock_movements"("product_id", "performed_at" DESC);

-- CreateIndex
CREATE INDEX "stock_movements_reference_type_reference_id_idx" ON "stock_movements"("reference_type", "reference_id");

-- CreateIndex
CREATE INDEX "audits_tenant_id_status_idx" ON "audits"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "audits_tenant_id_code_key" ON "audits"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "audit_counts_audit_id_idx" ON "audit_counts"("audit_id");

-- CreateIndex
CREATE UNIQUE INDEX "audit_counts_audit_id_product_id_key" ON "audit_counts"("audit_id", "product_id");

-- CreateIndex
CREATE UNIQUE INDEX "stock_adjustments_audit_count_id_key" ON "stock_adjustments"("audit_count_id");

-- CreateIndex
CREATE UNIQUE INDEX "stock_adjustments_movement_id_key" ON "stock_adjustments"("movement_id");

-- CreateIndex
CREATE INDEX "service_events_tenant_id_status_scheduled_at_idx" ON "service_events"("tenant_id", "status", "scheduled_at");

-- CreateIndex
CREATE UNIQUE INDEX "service_events_tenant_id_code_key" ON "service_events"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "audit_log_entity_entity_id_occurred_at_idx" ON "audit_log"("entity", "entity_id", "occurred_at" DESC);

-- CreateIndex
CREATE INDEX "audit_log_actor_id_occurred_at_idx" ON "audit_log"("actor_id", "occurred_at" DESC);

-- CreateIndex
CREATE INDEX "audit_log_tenant_id_occurred_at_idx" ON "audit_log"("tenant_id", "occurred_at" DESC);

-- CreateIndex
CREATE INDEX "low_stock_alerts_tenant_id_resolved_at_idx" ON "low_stock_alerts"("tenant_id", "resolved_at");

-- CreateIndex
CREATE UNIQUE INDEX "low_stock_alerts_product_id_warehouse_id_raised_at_key" ON "low_stock_alerts"("product_id", "warehouse_id", "raised_at");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_refresh_tokens" ADD CONSTRAINT "auth_refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "product_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "product_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_price_history" ADD CONSTRAINT "product_price_history_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_price_history" ADD CONSTRAINT "product_price_history_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_lines" ADD CONSTRAINT "recipe_lines_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_lines" ADD CONSTRAINT "recipe_lines_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_lines" ADD CONSTRAINT "recipe_lines_sub_recipe_id_fkey" FOREIGN KEY ("sub_recipe_id") REFERENCES "recipes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menus" ADD CONSTRAINT "menus_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_recipes" ADD CONSTRAINT "menu_recipes_menu_id_fkey" FOREIGN KEY ("menu_id") REFERENCES "menus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_recipes" ADD CONSTRAINT "menu_recipes_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_levels" ADD CONSTRAINT "stock_levels_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_levels" ADD CONSTRAINT "stock_levels_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_levels" ADD CONSTRAINT "stock_levels_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_performed_by_id_fkey" FOREIGN KEY ("performed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audits" ADD CONSTRAINT "audits_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audits" ADD CONSTRAINT "audits_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audits" ADD CONSTRAINT "audits_conducted_by_id_fkey" FOREIGN KEY ("conducted_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audits" ADD CONSTRAINT "audits_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_counts" ADD CONSTRAINT "audit_counts_audit_id_fkey" FOREIGN KEY ("audit_id") REFERENCES "audits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_counts" ADD CONSTRAINT "audit_counts_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_counts" ADD CONSTRAINT "audit_counts_counted_by_id_fkey" FOREIGN KEY ("counted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_audit_count_id_fkey" FOREIGN KEY ("audit_count_id") REFERENCES "audit_counts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_movement_id_fkey" FOREIGN KEY ("movement_id") REFERENCES "stock_movements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_events" ADD CONSTRAINT "service_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_events" ADD CONSTRAINT "service_events_menu_id_fkey" FOREIGN KEY ("menu_id") REFERENCES "menus"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_events" ADD CONSTRAINT "service_events_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_events" ADD CONSTRAINT "service_events_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_event_recipes" ADD CONSTRAINT "service_event_recipes_service_event_id_fkey" FOREIGN KEY ("service_event_id") REFERENCES "service_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_event_recipes" ADD CONSTRAINT "service_event_recipes_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "low_stock_alerts" ADD CONSTRAINT "low_stock_alerts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "low_stock_alerts" ADD CONSTRAINT "low_stock_alerts_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "low_stock_alerts" ADD CONSTRAINT "low_stock_alerts_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "low_stock_alerts" ADD CONSTRAINT "low_stock_alerts_resolved_by_id_fkey" FOREIGN KEY ("resolved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

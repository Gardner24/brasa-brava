-- =============================================================
-- Migración: RLS, columnas generadas, inmutabilidad de audit_log
-- Esta migración corre DESPUÉS del init de Prisma.
-- =============================================================

-- ===== Columnas generadas (cálculos a nivel de DB) ============

-- products.unit_cost = package_cost / package_size
ALTER TABLE products
  DROP COLUMN unit_cost,
  ADD COLUMN unit_cost numeric(14,6)
    GENERATED ALWAYS AS (
      CASE WHEN package_size > 0 THEN package_cost / package_size END
    ) STORED;

-- audit_counts.variance_qty = counted_qty - expected_qty
ALTER TABLE audit_counts
  DROP COLUMN variance_qty,
  ADD COLUMN variance_qty numeric(14,4)
    GENERATED ALWAYS AS (counted_qty - expected_qty) STORED;

-- audit_counts.variance_value = (counted_qty - expected_qty) * unit_cost
ALTER TABLE audit_counts
  DROP COLUMN variance_value,
  ADD COLUMN variance_value numeric(14,2)
    GENERATED ALWAYS AS ((counted_qty - expected_qty) * unit_cost) STORED;

-- ===== CHECK constraints =====================================

-- recipe_lines: exactamente uno de product_id / sub_recipe_id
ALTER TABLE recipe_lines
  ADD CONSTRAINT recipe_lines_exactly_one_target
  CHECK ((product_id IS NOT NULL) <> (sub_recipe_id IS NOT NULL));

-- recipe_lines: una receta no puede ser sub-receta de sí misma
ALTER TABLE recipe_lines
  ADD CONSTRAINT recipe_lines_no_self_reference
  CHECK (recipe_id IS DISTINCT FROM sub_recipe_id);

-- service_events.guest_count > 0
ALTER TABLE service_events
  ADD CONSTRAINT service_events_guests_positive
  CHECK (guest_count > 0);

-- ===== Row-Level Security (multi-tenancy) ====================
-- Política: cada conexión SET LOCAL app.current_tenant_id = '<uuid>'
-- ANTES de ejecutar cualquier query. Las queries solo ven filas
-- de su propio tenant.

-- helper: extrae el tenant_id del setting actual; lanza si falta
CREATE OR REPLACE FUNCTION current_tenant_id() RETURNS uuid
  LANGUAGE plpgsql STABLE AS $$
DECLARE v text;
BEGIN
  v := current_setting('app.current_tenant_id', true);
  IF v IS NULL OR v = '' THEN
    RAISE EXCEPTION 'app.current_tenant_id is not set' USING ERRCODE = '42501';
  END IF;
  RETURN v::uuid;
END
$$;

-- Aplicar RLS a todas las tablas tenant-scoped
DO $$
DECLARE
  t text;
  tenant_tables text[] := ARRAY[
    'users','product_categories','products','product_price_history',
    'recipes','recipe_lines','menus','menu_recipes',
    'warehouses','stock_levels','stock_movements',
    'audits','audit_counts','stock_adjustments',
    'service_events','service_event_recipes',
    'low_stock_alerts'
  ];
BEGIN
  FOREACH t IN ARRAY tenant_tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
  END LOOP;
END
$$;

-- Tablas que tienen tenant_id directamente: filtro simple
CREATE POLICY tenant_isolation ON users          USING (tenant_id = current_tenant_id());
CREATE POLICY tenant_isolation ON product_categories USING (tenant_id = current_tenant_id());
CREATE POLICY tenant_isolation ON products       USING (tenant_id = current_tenant_id());
CREATE POLICY tenant_isolation ON recipes        USING (tenant_id = current_tenant_id());
CREATE POLICY tenant_isolation ON menus          USING (tenant_id = current_tenant_id());
CREATE POLICY tenant_isolation ON warehouses     USING (tenant_id = current_tenant_id());
CREATE POLICY tenant_isolation ON stock_levels   USING (tenant_id = current_tenant_id());
CREATE POLICY tenant_isolation ON stock_movements USING (tenant_id = current_tenant_id());
CREATE POLICY tenant_isolation ON audits         USING (tenant_id = current_tenant_id());
CREATE POLICY tenant_isolation ON service_events USING (tenant_id = current_tenant_id());
CREATE POLICY tenant_isolation ON low_stock_alerts USING (tenant_id = current_tenant_id());

-- Tablas que NO tienen tenant_id directo: filtro vía join
CREATE POLICY tenant_isolation ON product_price_history
  USING (EXISTS (SELECT 1 FROM products p WHERE p.id = product_price_history.product_id AND p.tenant_id = current_tenant_id()));

CREATE POLICY tenant_isolation ON recipe_lines
  USING (EXISTS (SELECT 1 FROM recipes r WHERE r.id = recipe_lines.recipe_id AND r.tenant_id = current_tenant_id()));

CREATE POLICY tenant_isolation ON menu_recipes
  USING (EXISTS (SELECT 1 FROM menus m WHERE m.id = menu_recipes.menu_id AND m.tenant_id = current_tenant_id()));

CREATE POLICY tenant_isolation ON audit_counts
  USING (EXISTS (SELECT 1 FROM audits a WHERE a.id = audit_counts.audit_id AND a.tenant_id = current_tenant_id()));

CREATE POLICY tenant_isolation ON stock_adjustments
  USING (EXISTS (SELECT 1 FROM audit_counts ac JOIN audits a ON a.id = ac.audit_id WHERE ac.id = stock_adjustments.audit_count_id AND a.tenant_id = current_tenant_id()));

CREATE POLICY tenant_isolation ON service_event_recipes
  USING (EXISTS (SELECT 1 FROM service_events s WHERE s.id = service_event_recipes.service_event_id AND s.tenant_id = current_tenant_id()));

-- user_roles: filtro vía user
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles FORCE  ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON user_roles
  USING (EXISTS (SELECT 1 FROM users u WHERE u.id = user_roles.user_id AND u.tenant_id = current_tenant_id()));

-- auth_refresh_tokens: filtro vía user
ALTER TABLE auth_refresh_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_refresh_tokens FORCE  ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON auth_refresh_tokens
  USING (EXISTS (SELECT 1 FROM users u WHERE u.id = auth_refresh_tokens.user_id AND u.tenant_id = current_tenant_id()));

-- audit_log: tiene tenant_id (nullable para eventos pre-login)
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log FORCE  ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON audit_log
  USING (tenant_id IS NULL OR tenant_id = current_tenant_id());

-- ===== Inmutabilidad de audit_log ============================
-- Revocamos UPDATE y DELETE al rol de aplicación: ni un bug puede
-- alterar el rastro. INSERT y SELECT permanecen.
REVOKE UPDATE, DELETE, TRUNCATE ON audit_log FROM PUBLIC;
REVOKE UPDATE, DELETE, TRUNCATE ON audit_log FROM brasa_app;
GRANT  SELECT, INSERT ON audit_log TO brasa_app;

-- Trigger defensivo adicional: aunque alguien haga GRANT por error,
-- cualquier UPDATE/DELETE en audit_log explota.
CREATE OR REPLACE FUNCTION audit_log_immutable() RETURNS trigger
  LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only: % is not allowed', TG_OP USING ERRCODE = '42501';
END
$$;

CREATE TRIGGER audit_log_no_update BEFORE UPDATE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION audit_log_immutable();
CREATE TRIGGER audit_log_no_delete BEFORE DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION audit_log_immutable();

-- ===== Trigger: histórico de precios automático ==============
-- Cuando cambia products.package_cost o package_size, se inserta
-- una fila en product_price_history. El actor sale del setting
-- 'app.current_user_id' que el backend setea por request.
CREATE OR REPLACE FUNCTION product_price_history_trigger() RETURNS trigger
  LANGUAGE plpgsql AS $$
DECLARE
  v_user uuid;
BEGIN
  IF (TG_OP = 'UPDATE') AND
     (NEW.package_cost IS DISTINCT FROM OLD.package_cost
      OR NEW.package_size IS DISTINCT FROM OLD.package_size) THEN
    BEGIN
      v_user := current_setting('app.current_user_id', true)::uuid;
    EXCEPTION WHEN OTHERS THEN
      v_user := NULL;
    END;

    IF v_user IS NOT NULL AND NEW.package_cost IS NOT NULL AND NEW.package_size IS NOT NULL THEN
      INSERT INTO product_price_history (id, product_id, package_cost, package_size, source, created_by_id)
      VALUES (gen_random_uuid(), NEW.id, NEW.package_cost, NEW.package_size, 'auto-trigger', v_user);
    END IF;
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER products_price_history
  AFTER UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION product_price_history_trigger();

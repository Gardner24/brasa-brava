-- =============================================================
-- Fase 3 — Inventario
-- Aditiva: nuevas columnas, enum waste_reason, triggers de stock
-- y de alertas de stock bajo (decisión E1: trigger sincrónico DB).
-- =============================================================

-- 1. Enum waste_reason
CREATE TYPE waste_reason AS ENUM (
  'EXPIRED', 'SPOILED', 'DAMAGED', 'PREP_LOSS', 'CUSTOMER_RETURN', 'OTHER'
);

-- 2. Nuevas columnas en stock_movements
ALTER TABLE stock_movements
  ADD COLUMN waste_reason waste_reason,
  ADD COLUMN paired_movement_id uuid UNIQUE REFERENCES stock_movements(id) ON DELETE NO ACTION;

CREATE INDEX ix_stock_movements_warehouse_time
  ON stock_movements (warehouse_id, performed_at DESC);

-- 3. avg_unit_cost en stock_levels (weighted average — decisión B2)
ALTER TABLE stock_levels
  ADD COLUMN avg_unit_cost numeric(14,6);

-- 4. Denormalizados en products para "días de cobertura"
ALTER TABLE products
  ADD COLUMN last_consumption_at timestamptz,
  ADD COLUMN avg_daily_consumption numeric(14,4);

-- =============================================================
-- 5. Trigger de proyección de stock_levels
-- Cada INSERT a stock_movements actualiza qty_on_hand y avg_unit_cost
-- siguiendo la fórmula del promedio ponderado.
-- =============================================================
CREATE OR REPLACE FUNCTION apply_stock_movement() RETURNS trigger
  LANGUAGE plpgsql AS $$
DECLARE
  v_current_qty  numeric(14,4);
  v_current_cost numeric(14,6);
  v_new_qty      numeric(14,4);
  v_new_cost     numeric(14,6);
BEGIN
  -- Lock-aware upsert: bloquea la fila para evitar race conditions
  -- (dos movements concurrentes sobre el mismo product+warehouse).
  SELECT qty_on_hand, avg_unit_cost
    INTO v_current_qty, v_current_cost
  FROM stock_levels
  WHERE product_id = NEW.product_id AND warehouse_id = NEW.warehouse_id
  FOR UPDATE;

  IF NOT FOUND THEN
    v_current_qty  := 0;
    v_current_cost := NULL;
  END IF;

  v_new_qty := v_current_qty + NEW.qty;

  -- Recálculo de avg_unit_cost:
  -- - Si entró stock (qty > 0) Y trae unit_cost → weighted average con lo existente
  -- - Si salió stock (qty < 0) → mantenemos el avg_unit_cost actual
  -- - Si entró pero sin unit_cost (raro) → mantenemos también
  IF NEW.qty > 0 AND NEW.unit_cost IS NOT NULL THEN
    IF v_current_qty <= 0 OR v_current_cost IS NULL THEN
      -- Stock estaba en 0 (o negativo, "limpiamos" cuenta) → costo nuevo es el del movement
      v_new_cost := NEW.unit_cost;
    ELSE
      -- Promedio ponderado clásico: (qty_old * cost_old + qty_in * cost_in) / (qty_old + qty_in)
      v_new_cost := ((v_current_qty * v_current_cost) + (NEW.qty * NEW.unit_cost))
                  / NULLIF(v_current_qty + NEW.qty, 0);
    END IF;
  ELSE
    v_new_cost := v_current_cost;
  END IF;

  INSERT INTO stock_levels (product_id, warehouse_id, tenant_id, qty_on_hand, avg_unit_cost, updated_at)
  VALUES (NEW.product_id, NEW.warehouse_id, NEW.tenant_id, v_new_qty, v_new_cost, now())
  ON CONFLICT (product_id, warehouse_id) DO UPDATE
    SET qty_on_hand   = v_new_qty,
        avg_unit_cost = v_new_cost,
        updated_at    = now();

  -- Mantener products.last_consumption_at para el cálculo de cobertura
  IF NEW.movement_type IN ('CONSUMPTION', 'WASTE', 'TRANSFER_OUT') THEN
    UPDATE products
       SET last_consumption_at = NEW.performed_at
     WHERE id = NEW.product_id;
  END IF;

  RETURN NEW;
END
$$;

CREATE TRIGGER stock_movements_apply
  AFTER INSERT ON stock_movements
  FOR EACH ROW EXECUTE FUNCTION apply_stock_movement();

-- =============================================================
-- 6. Trigger de alertas de stock bajo (decisión E1)
-- Se evalúa AFTER el trigger de proyección, así qty_on_hand ya está fresco.
-- =============================================================
CREATE OR REPLACE FUNCTION evaluate_low_stock_alert() RETURNS trigger
  LANGUAGE plpgsql AS $$
DECLARE
  v_qty           numeric(14,4);
  v_reorder_point numeric(14,4);
  v_tenant_id     uuid;
  v_existing_id   uuid;
BEGIN
  -- Stock actualizado por el trigger anterior
  SELECT sl.qty_on_hand, p.reorder_point, sl.tenant_id
    INTO v_qty, v_reorder_point, v_tenant_id
  FROM stock_levels sl
  JOIN products p ON p.id = sl.product_id
  WHERE sl.product_id = NEW.product_id AND sl.warehouse_id = NEW.warehouse_id;

  -- Si no hay reorder_point configurado, no hay alerta posible
  IF v_reorder_point IS NULL THEN
    RETURN NEW;
  END IF;

  IF v_qty < v_reorder_point THEN
    -- ¿Hay alerta abierta para este producto+almacén?
    SELECT id INTO v_existing_id
    FROM low_stock_alerts
    WHERE product_id = NEW.product_id
      AND warehouse_id = NEW.warehouse_id
      AND resolved_at IS NULL
    LIMIT 1;

    IF v_existing_id IS NULL THEN
      -- Crear alerta nueva
      INSERT INTO low_stock_alerts (id, tenant_id, product_id, warehouse_id, qty_on_hand, reorder_point, raised_at)
      VALUES (gen_random_uuid(), v_tenant_id, NEW.product_id, NEW.warehouse_id, v_qty, v_reorder_point, now());
    END IF;
    -- Si ya existe, no la duplicamos. El qty_on_hand de la fila refleja
    -- el momento en que se generó; la query GET /alerts hace JOIN al
    -- stock_level actual para mostrar valor live.
  ELSE
    -- Stock recuperado: cerrar alertas abiertas automáticamente
    UPDATE low_stock_alerts
       SET resolved_at = now()
     WHERE product_id = NEW.product_id
       AND warehouse_id = NEW.warehouse_id
       AND resolved_at IS NULL;
  END IF;

  RETURN NEW;
END
$$;

CREATE TRIGGER stock_movements_evaluate_alerts
  AFTER INSERT ON stock_movements
  FOR EACH ROW EXECUTE FUNCTION evaluate_low_stock_alert();

-- =============================================================
-- 7. Función auxiliar: recalcular avg_daily_consumption
-- Llamada desde un job nightly (o manual) — más barato que trigger por movement.
-- Calcula el promedio diario de salidas (CONSUMPTION + WASTE) últimos 30 días.
-- =============================================================
CREATE OR REPLACE FUNCTION recalc_avg_daily_consumption(p_product_id uuid) RETURNS void
  LANGUAGE plpgsql AS $$
DECLARE
  v_total_out numeric(14,4);
  v_days      integer;
BEGIN
  SELECT
    COALESCE(SUM(ABS(qty)), 0),
    GREATEST(1, EXTRACT(DAY FROM now() - MIN(performed_at))::integer)
    INTO v_total_out, v_days
  FROM stock_movements
  WHERE product_id = p_product_id
    AND movement_type IN ('CONSUMPTION', 'WASTE', 'TRANSFER_OUT')
    AND performed_at >= now() - interval '30 days';

  UPDATE products
     SET avg_daily_consumption = CASE
       WHEN v_total_out > 0 THEN v_total_out / v_days
       ELSE NULL
     END
   WHERE id = p_product_id;
END
$$;

-- =============================================================
-- Fase 2 — Aliases de productos + optimistic concurrency
-- Migración aditiva: NO toca tablas existentes destructivamente.
-- =============================================================

-- 1. Optimistic concurrency: columna version en entidades editables
ALTER TABLE products ADD COLUMN version integer NOT NULL DEFAULT 0;
ALTER TABLE recipes  ADD COLUMN version integer NOT NULL DEFAULT 0;

-- 2. Tabla de aliases para productos
CREATE TABLE product_aliases (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id    uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  alias         varchar(120) NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  created_by_id uuid REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE (product_id, alias)
);

CREATE INDEX ix_product_aliases_alias ON product_aliases (alias);

-- 3. RLS para la nueva tabla (filtro vía join al producto)
ALTER TABLE product_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_aliases FORCE  ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON product_aliases
  USING (
    EXISTS (
      SELECT 1 FROM products p
      WHERE p.id = product_aliases.product_id
        AND p.tenant_id = current_tenant_id()
    )
  );

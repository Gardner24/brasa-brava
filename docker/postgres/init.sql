-- =============================================================
-- Inicialización de cluster Postgres para Brasa Brava
-- Se ejecuta automáticamente al primer arranque del contenedor.
-- =============================================================

-- Extensiones requeridas
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- Rol de aplicación con permisos LIMITADOS:
-- el backend NO debe poder UPDATE ni DELETE sobre audit_log.
-- El password real se inyecta vía env en la migración SQL Prisma.
-- Aquí solo se crea el rol vacío para que las migraciones puedan asignarle permisos.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'brasa_app') THEN
    CREATE ROLE brasa_app LOGIN PASSWORD 'change_me_in_local_env';
  END IF;
END
$$;

-- Otorgar permisos básicos en el schema público
GRANT CONNECT ON DATABASE brasa_brava TO brasa_app;
GRANT USAGE ON SCHEMA public TO brasa_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO brasa_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO brasa_app;

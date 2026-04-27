# Brasa Brava — Sistema de Inventario y Auditoría

Monorepo del Sistema de Gestión de Inventarios y Auditoría de Brasa Brava.

## Arquitectura

- **Backend**: Fastify + TypeScript + Prisma + PostgreSQL 16 (Clean / Hexagonal)
- **Frontend**: React 18 + Vite + TailwindCSS + shadcn/ui + i18next
- **Auth**: JWT propio (Argon2id, refresh rotativo, TOTP opcional)
- **Multi-tenant**: single-DB con `tenant_id` + Postgres Row-Level Security
- **Audit trail**: tabla `audit_log` inmutable (UPDATE/DELETE revocados al rol de app)

Ver carpeta raíz del workspace para los ADRs:

- `00_PROPUESTA_ARQUITECTURA_v0.1.md`
- `01_DECISION_CATEGORIAS_v1.0.md` (ADR-001)
- `02_ARQUITECTURA_v1.0_CONGELADA.md` (ADR-002 a ADR-007)

## Estructura

```
brasa-brava/
├─ apps/
│  ├─ api/                # Backend Fastify
│  └─ web/                # Frontend React + Vite
├─ packages/
│  ├─ db/                 # Prisma schema + migrations + seed
│  ├─ shared-types/       # Zod schemas + DTOs compartidos
│  └─ config/             # Configs comunes (ESLint, tsconfig)
├─ docker/                # Dockerfiles dev
├─ docker-compose.yml     # Stack local
└─ .github/workflows/     # CI
```

## Prerrequisitos

- Node.js ≥ 20.11
- pnpm ≥ 9
- Docker + Docker Compose

## Quick start

```bash
# 1. Clonar y configurar
cp .env.example .env
# editar .env con valores reales (especialmente JWT secrets y passwords)

# 2. Levantar stack de infra (Postgres + Redis + MailHog)
pnpm compose:up

# 3. Instalar dependencias
pnpm install

# 4. Aplicar migraciones + seed desde Excel
pnpm db:migrate
pnpm db:seed

# 5. Levantar API + Web en modo dev (parallel)
pnpm dev
```

Servicios:

- API: http://localhost:4000  (OpenAPI: http://localhost:4000/docs)
- Web: http://localhost:5173
- MailHog UI: http://localhost:8025
- Postgres: localhost:5432
- Redis: localhost:6379

## Scripts

| Comando | Descripción |
|---|---|
| `pnpm dev` | API + Web en paralelo con HMR |
| `pnpm build` | Compila todos los workspaces |
| `pnpm lint` | ESLint en todos los workspaces |
| `pnpm typecheck` | tsc --noEmit en todos los workspaces |
| `pnpm test` | Vitest en todos los workspaces |
| `pnpm db:migrate` | Aplica Prisma migrations |
| `pnpm db:seed` | Pobla DB desde el Excel + admin inicial |
| `pnpm db:reset` | Drop + recrear + migrate + seed |

## Roles iniciales (seed)

| Rol | Permisos |
|---|---|
| `ADMIN` | Todo |
| `AUDITOR` | Crear/ejecutar auditorías, reportes |
| `OPERATOR` | Movimientos, conteos, lectura |
| `VIEWER` | Solo lectura |

Usuario admin inicial creado por seed: ver `SEED_ADMIN_EMAIL` en `.env`.

## Próximos pasos (Fase 2+)

- CRUD productos / recetas / sub-recetas
- Editor de escandallo en vivo
- Modo conteo de auditoría (UI tablet)
- Reporte P&L de auditoría con export PDF/XLSX
- Alertas de stock bajo (job + email + in-app)

# Brasa Brava — Plan maestro

**Documento de referencia operativo.** Refleja el **estado real del código** auditado, no asunciones. Se actualiza al cierre de cada fase.

**Última auditoría:** 2026-04-27
**Última fase cerrada:** Fase 2 (Catálogo + Recetas + Branding)
**Fase en curso:** Fase 3 (Inventario) — Bloques 1-6 ✅, Bloque 7 (deuda técnica) ⏳

---

## 1. Stack confirmado

### Workspaces (`pnpm-workspace.yaml`)

```
apps/api               Backend Fastify
apps/web               Frontend React + Vite
packages/db            Prisma schema + migrations + seed
packages/shared-types  Zod schemas + DTOs compartidos backend↔frontend
packages/config        ESLint + tsconfig (sin código fuente)
```

### Backend
| Capa | Versión | Notas |
|---|---|---|
| Node | ≥20.11 | dev server con `tsx --env-file=../../.env watch` |
| Fastify | 4.29.1 | ⚠️ Upgrade a v5 pendiente (SECURITY-001) |
| @fastify/jwt | 8.0.1 | trae fast-jwt 4.x (CVE pendiente) |
| Prisma | 5.22.0 | client + migrate |
| Zod | 3.23.8 | validación request/response + schemas compartidos |
| Argon2 | 0.40.3 | argon2id memory 19MB time 2 |
| Pino | con pino-pretty en dev | redact aplicado a authorization, password, tokens |
| Vitest | 2.0.5 | 3 spec files (cobertura mínima — deuda) |

### Frontend
| Capa | Versión | Notas |
|---|---|---|
| React | 18.3.1 | StrictMode habilitado |
| Vite | 5.3.5 | envDir apunta a raíz monorepo |
| react-router-dom | 6.26.0 | code-based routing en `App.tsx` |
| @tanstack/react-query | 5.51.15 | hooks por recurso en `lib/queries.ts` |
| @tanstack/react-table | 8.20.1 | declarado, aún no usado (tablas son HTML plano) |
| Tailwind | 3.4.7 | tokens Brasa Brava: charcoal/ember/cream/wood/tortilla |
| i18next | 23.12.2 | namespaces `common/dashboard/catalog/recipes/audit`, ES + EN |
| Radix | dialog, dropdown, slot | base para drawers (no usado todavía) |
| react-hook-form | 7.52.1 | declarado, no usado (forms aún imperativos) |
| lucide-react | 0.408.0 | iconografía |
| Playfair Display | Google Fonts | tipografía display de marca |

### Infraestructura
- **docker-compose.yml** — Postgres 16-alpine + Redis 7-alpine + MailHog 1.0.1 (perfilable con `profiles: ['app']`)
- **Dockerfiles** — `api.Dockerfile` y `web.Dockerfile` multi-stage (dev/build/prod). **Imagen prod nunca probada en CI/local.**
- **Postgres init.sql** — crea extensiones (`uuid-ossp`, `pgcrypto`, `citext`, `btree_gin`) + rol `brasa_app`
- **CI** — GitHub Actions con 5 jobs: lint+typecheck, unit tests, integration tests (Postgres real), build, security audit (continue-on-error). + CodeQL semanal.

### Migraciones aplicadas (cronológico)

| Timestamp | Nombre | Descripción |
|---|---|---|
| 20260424023140 | `init` | 23 tablas + 6 enums |
| 20991231000000 | `rls_and_immutability` | RLS forzado en 17 tablas, columnas generadas (`unit_cost`, `variance_qty`, `variance_value`), CHECK constraints, audit_log inmutable, trigger de price history |
| 20991232000000 | `phase2_aliases_version` | `product_aliases` table + `version` columns para optimistic locking |
| 20991233000000 | `phase3_inventory` | `waste_reason` enum, `paired_movement_id` para transfers, `avg_unit_cost` (PWAC), denormalizados de consumo, triggers `apply_stock_movement` y `evaluate_low_stock_alert` |

---

## 2. Modelo de datos (23 tablas, 6 enums)

### Identidad y RBAC
- `tenants`, `users`, `roles`, `user_roles`, `auth_refresh_tokens`

### Catálogo
- `product_categories` (jerarquía vía `parent_id`)
- `products` (bilingual JSON `name`, `unit_cost` GENERATED, `version` para optimistic locking, denormalizados `last_consumption_at` + `avg_daily_consumption`)
- `product_aliases` (resolución legacy)
- `product_price_history` (auto-trigger en UPDATE de `package_cost`/`package_size`)

### Recetas
- `recipes` (bilingual `name`, `version`)
- `recipe_lines` (XOR `product_id` ⊕ `sub_recipe_id`, CHECK constraint)
- `menus`, `menu_recipes`

### Inventario
- `warehouses`
- `stock_levels` (PK compuesta producto+almacén, `qty_on_hand`, `avg_unit_cost` PWAC)
- `stock_movements` (8 tipos vía enum `MovementType`, `paired_movement_id` para transfer, `waste_reason`)
- `low_stock_alerts` (auto-creadas por trigger DB)

### Auditorías (esquema sí, endpoints no)
- `audits` (5 modos: FULL/CATEGORY/SPOT/ABC_CYCLE/CUSTOM)
- `audit_counts` (`variance_qty` + `variance_value` GENERATED)
- `stock_adjustments` (1:1 con audit_counts)

### Servicio
- `service_events` (CHECK `guest_count > 0`)
- `service_event_recipes`

### Audit trail
- `audit_log` (inmutable a nivel DB: UPDATE/DELETE revocados al rol app + trigger defensivo)

### RLS confirmado en 17 tablas
Filtro tenant directo: `users`, `product_categories`, `products`, `recipes`, `menus`, `warehouses`, `stock_levels`, `stock_movements`, `audits`, `service_events`, `low_stock_alerts`.
Filtro vía join: `product_price_history` (→ products), `product_aliases` (→ products), `recipe_lines` (→ recipes), `menu_recipes` (→ menus), `audit_counts` (→ audits), `stock_adjustments` (→ audits), `service_event_recipes` (→ service_events), `user_roles` (→ users), `auth_refresh_tokens` (→ users).
`audit_log` con política especial: `tenant_id IS NULL OR = current_tenant_id()`.

### Triggers DB activos
| Trigger | Tabla | Cuándo | Lógica |
|---|---|---|---|
| `audit_log_no_update` | audit_log | BEFORE UPDATE | RAISE EXCEPTION |
| `audit_log_no_delete` | audit_log | BEFORE DELETE | RAISE EXCEPTION |
| `products_price_history` | products | AFTER UPDATE | INSERT en price_history si cambia `package_cost` o `package_size` |
| `stock_movements_apply` | stock_movements | AFTER INSERT | Actualiza `stock_levels.qty_on_hand` y recalcula `avg_unit_cost` (PWAC); marca `last_consumption_at` |
| `stock_movements_evaluate_alerts` | stock_movements | AFTER INSERT | Crea o resuelve `low_stock_alerts` según `qty_on_hand` vs `reorder_point` |

### Función auxiliar
`recalc_avg_daily_consumption(product_id)` — diseñada para job nightly. **No hay scheduler que la llame todavía.**

---

## 3. Endpoints implementados (40 total)

| Router | # endpoints | Estado |
|---|---|---|
| `/health` | 2 | ✅ |
| `/auth` | 4 | ✅ login, refresh, logout, me — MFA en stub |
| `/products` | 8 | ✅ CRUD + price-history + aliases |
| `/recipes` | 7 | ✅ CRUD + lines + scale (cycle detection vía `detectCycle()` helper, profundidad ≤10) |
| `/categories` | 4 | ✅ |
| `/warehouses` | 4 | ✅ con métricas (itemsCount, totalValueCRC, openAlertsCount) |
| `/movements` | 6 | ✅ purchase/consumption/waste/transfer/adjustment + list |
| `/stock` | 2 | ✅ list + valuation por categoría |
| `/audit-log` | 1 | ✅ paginado + filtros (entity, entityId, actor, action, fechas) |
| `/alerts` | 2 | ✅ list + resolve manual |

Todos registrados en `apps/api/src/server.ts` líneas 105-114. Permisos verificados con `app.requirePermission('...')` en cada endpoint sensible.

### Endpoints faltantes (modelos existen, lógica no)

| Recurso | Endpoints faltantes | Modelo en schema |
|---|---|---|
| Service events | `GET /service-events`, `POST /service-events`, `PATCH /service-events/:id/execute`, `PATCH /service-events/:id/cancel` | ✅ `service_events`, `service_event_recipes` |
| Menus | `GET /menus`, CRUD admin (relación recetas ↔ menús) | ✅ `menus`, `menu_recipes` |
| Audits | Todo el CRUD de auditorías (Fase 4) | ✅ `audits`, `audit_counts`, `stock_adjustments` |
| Users admin | Crear/editar/desactivar usuarios, asignar roles | ✅ `users`, `roles`, `user_roles` (solo admin del seed existe) |

---

## 4. Frontend — vistas implementadas

### Páginas (5 archivos en `apps/web/src/pages/`)

| Página | Lectura | Mutaciones | API conectado | Idiomas |
|---|---|---|---|---|
| `LoginPage.tsx` | Hero + form | `login()` | ✅ | ES/EN |
| `Dashboard.tsx` | Skeleton 4 KPIs | — | ❌ KPIs hardcoded a `—` | ES/EN |
| `CatalogPage.tsx` | Tabla productos paginada con filtros (search, categoryCode, dataQualityIssue, includeArchived) | Refetch | ✅ GET /products + GET /categories | ES/EN |
| `RecipesPage.tsx` | Lista + detalle split-pane con costo recursivo + instructions | — (solo lectura) | ✅ GET /recipes + GET /recipes/:id | ES/EN |
| `AuditLogPage.tsx` | Timeline filtrable, JSON diff expandible | — | ✅ GET /audit-log | ES/EN |

### Componentes implementados

**Layout (3):** `AppShell.tsx`, `Sidebar.tsx` (tortilla bg + ember active), `Topbar.tsx` (user pill + logout)
**Branding (2):** `BrandMark.tsx`, `HeroIntro.tsx` (SVG inline con brasas + grill)
**UI base (8):** `badge.tsx` (con `categoryVariant()` por categoría), `button.tsx`, `card.tsx`, `input.tsx`, `language-switcher.tsx`, `select.tsx`, `skeleton.tsx`, `spinner.tsx`

### Auth + cliente API

`lib/auth-context.tsx` — `AuthProvider` con auto-refresh 60s antes del expiry, login/logout, `hasPermission()`
`lib/api.ts` — fetch wrapper con `Bearer` y `ApiError` tipado
`lib/queries.ts` — hooks TanStack Query: `useProducts`, `useProduct`, `useCreateProduct`, `useUpdateProduct`, `useRecipes`, `useRecipe`, `useCategories`, `useAuditLog`. **Faltan:** warehouses, movements, stock, alerts.

### i18n
ES y EN paritarios en `common`, `dashboard`, `catalog`, `recipes`, `audit`. **Falta:** namespace `inventory` (movements + alerts + warehouses).

### Dependencias declaradas pero NO usadas todavía
- `@tanstack/react-table` (tablas son HTML plano por ahora)
- `react-hook-form` + `@hookform/resolvers` (forms aún imperativos)
- `@radix-ui/react-dialog` (no hay drawers/modales aún)

---

## 5. Matriz de funcionalidades (estado real)

| # | Funcionalidad | Backend | Frontend | Notas |
|---|---|---|---|---|
| **Identity** | | | | |
| 1.1 | Login email + password | ✅ | ✅ | |
| 1.2 | Refresh rotativo + reuse detection | ✅ | ✅ (auto cada 14m) | |
| 1.3 | Logout + revoke all | ✅ | ✅ | |
| 1.4 | MFA TOTP | 🟡 stub | ❌ | TODO en `auth.routes.ts:77` — no se valida el TOTP recibido |
| 1.5 | Gestión usuarios | ❌ | ❌ | Solo admin del seed; ni endpoints ni UI |
| **Catálogo** | | | | |
| 2.1 | Listar productos con filtros | ✅ | ✅ | |
| 2.2 | Detalle producto | ✅ | ❌ | Hay endpoint y hook, falta página de detalle |
| 2.3 | Crear producto | ✅ | ❌ | Botón "+ Nuevo" sin handler |
| 2.4 | Editar producto (optimistic locking) | ✅ | ❌ | |
| 2.5 | Archivar producto (soft delete + dependency check) | ✅ | ❌ | |
| 2.6 | Aliases (CRUD) | ✅ | ❌ | |
| 2.7 | Histórico de precios | ✅ | ❌ | Trigger DB activo, endpoint listo |
| **Categorías** | | | | |
| 3.1 | Listar | ✅ | ✅ (en select de catálogo) | |
| 3.2 | CRUD admin | ✅ | ❌ | |
| **Recetas** | | | | |
| 4.1 | Listar recetas | ✅ | ✅ | |
| 4.2 | Detalle con costo recursivo (CTE) | ✅ | ✅ | Validado contra Excel: ₡107.44 = 2148.77/20 |
| 4.3 | Crear receta vacía | ✅ | ❌ | |
| 4.4 | Editar metadata | ✅ | ❌ | |
| 4.5 | Replace lines (atómico) | ✅ | ❌ | |
| 4.6 | Detección de ciclos en sub-recetas | ✅ | — | `detectCycle()` con `WITH RECURSIVE`, profundidad ≤10 |
| 4.7 | Scale (simulador N comensales) | ✅ | ❌ | |
| 4.8 | Archivar | ✅ | ❌ | |
| **Almacenes** | | | | |
| 5.1 | Listar con métricas (items, valor, alertas abiertas) | ✅ | ✅ | WarehousesPage con cards + drill al inventario |
| 5.2 | CRUD admin | ✅ | ❌ | UI de creación/edición pendiente (Bloque diferido) |
| **Stock** | | | | |
| 6.1 | Listar stock por almacén | ✅ | ✅ | InventoryPage con tabla + filtros (categoría, bajo reorden, negativos) |
| 6.2 | Valorización por categoría | ✅ | ✅ | Sección dentro de InventoryPage con grand total |
| 6.3 | Días de cobertura | 🟡 | ❌ | Datos denormalizados existen, falta job nocturno que llame `recalc_avg_daily_consumption()` |
| **Movements** | | | | |
| 7.1 | Compra (PURCHASE) con weighted average | ✅ | ✅ | Validado e2e: 17 000 ml × ₡3,5 → PWAC = ₡3,5, valor ₡59 500 |
| 7.2 | Consumo (CONSUMPTION) | ✅ | ✅ | Snapshot de avg al momento del move |
| 7.3 | Merma (WASTE) con razón obligatoria | ✅ | ✅ | Select de WasteReason en UI |
| 7.4 | Transferencia atómica entre almacenes | ✅ | ✅ | UI bloquea fromWarehouse == toWarehouse |
| 7.5 | Ajuste manual con justificación | ✅ | ✅ | Notas obligatorias (≥5 chars) en form |
| 7.6 | Listar movements (libro mayor) | ✅ | ✅ | MovementsPage con filtros warehouse/type/fechas |
| **Alertas stock bajo** | | | | |
| 8.1 | Trigger DB que crea/cierra alertas | ✅ | — | Decisión E1 implementada — validado e2e: stock 16 850 < reorder 20 000 → trigger crea alerta |
| 8.2 | Listar alertas (open/all + filtro por almacén) | ✅ | ✅ | AlertsPage con cards, filtro warehouse + toggle "Mostrar resueltas" |
| 8.3 | Resolver manualmente | ✅ | ✅ | Form inline en card con notes opcionales |
| **Service events** | | | | |
| 9.1 | CRUD eventos planificados | ❌ | ❌ | Modelo existe |
| 9.2 | Marcar EXECUTED | ❌ | ❌ | Decisión C2: NO auto-consume |
| 9.3 | Cancelar | ❌ | ❌ | |
| **Auditorías (Fase 4)** | | | | |
| 10.1 | Crear sesión de auditoría | ❌ | ❌ | Modelo + RLS listos |
| 10.2 | Modo conteo (UI tablet) | ❌ | ❌ | |
| 10.3 | Conciliación → genera ADJUSTMENT | ❌ | ❌ | |
| 10.4 | Reporte P&L | ❌ | ❌ | |
| **Audit trail** | | | | |
| 11.1 | Endpoint `/audit-log` paginado y filtrable | ✅ | ✅ | |
| 11.2 | Diff visual (JSON dump) | ✅ | ✅ | Mejora futura: diff visual estructurado |
| **Branding** | | | | |
| 12.1 | Hero intro con scroll | ✅ | — | |
| 12.2 | Paleta charcoal/ember/cream | ✅ | — | |
| 12.3 | Tipografía display Playfair | ✅ | — | |
| 12.4 | Switch ES/EN live sin recargar | ✅ | — | |
| **CI / DevOps** | | | | |
| 13.1 | Lint + typecheck | ✅ | — | |
| 13.2 | Unit tests | 🟡 | — | Solo 3 spec files (audit-helper, product.entity, recipe-cost) |
| 13.3 | Integration tests (Postgres real) | 🟡 | — | Servicio CI corre, sin tests reales aún |
| 13.4 | Build prod | ✅ | — | |
| 13.5 | Security audit | 🟡 | — | continue-on-error por SECURITY-001 |
| 13.6 | CodeQL semanal | ✅ | — | |
| 13.7 | E2E con Playwright | ❌ | ❌ | Planificado, no instalado |
| 13.8 | Docker prod imagen testeada | ❌ | ❌ | Multi-stage existe, nunca built |
| 13.9 | OpenAPI auto-doc | 🟡 | — | Swagger UI activo en `/docs`, schemas no rigurosos en todas las rutas |

---

## 6. Deuda técnica (priorizada)

### 🔴 Alta — resolver antes o durante Fase 3

**DT-001: Fastify 4 → 5 ecosystem upgrade (SECURITY-001)**
- Causa el `continue-on-error: true` en CI security audit
- Vulnerabilidades activas: `fast-jwt <6.2.0` (algorithm confusion + cache confusion), `fastify <5.7.2` (Content-Type tab bypass)
- Mitigaciones operativas en `SECURITY.md` (no usamos `crit` headers, validación Zod en cada handler)
- Cadena de upgrade documentada: 8 plugins + ajustes a `server.ts`
- **Estimado:** 1 día. Tests E2E cubren la regresión.

**DT-002: MFA TOTP stub**
- `apps/api/src/infrastructure/http/routes/auth.routes.ts:77` recibe el `totp` pero no lo valida
- Si un admin habilita MFA, cualquier código de 6 dígitos pasa
- **Acción:** instalar `otplib`, validar contra `user.mfaSecret`, agregar setup endpoint (`POST /auth/mfa/enroll` + `POST /auth/mfa/confirm`)
- **Estimado:** 0.5 día

**DT-003: Cobertura de tests insuficiente**
- 3 spec files cubren ~5% del código
- Sin tests de integración reales (CI corre el job pero no hay specs que lo aprovechen)
- Sin E2E con Playwright
- **Acción mínima:** tests de integración para los flujos críticos (login → CRUD producto → CRUD receta → movement → alerta), Playwright para login + dashboard
- **Estimado:** 2-3 días distribuidos en cada fase

### 🟡 Media — resolver durante Fase 3 o 4

**DT-004: Job nocturno faltante**
- `recalc_avg_daily_consumption(product_id)` existe pero nadie la llama
- Sin esto, `daysCoverage` en stock query siempre devuelve `null`
- **Acción:** agregar job en API (BullMQ + Redis) que recorre todos los productos activos cada noche
- **Estimado:** 0.5 día

**DT-005: Imagen Docker prod nunca verificada**
- `docker/api.Dockerfile` y `docker/web.Dockerfile` existen con stages multi-build
- Nunca se ejecutó `docker build --target prod` ni se desplegó
- Sin test de smoke en CI
- **Acción:** job CI que builda imágenes prod y arranca un compose simulando deploy
- **Estimado:** 0.5 día

**DT-006: Tablas HTML planas en lugar de TanStack Table**
- `@tanstack/react-table` declarado pero no usado
- Catálogo escala bien hasta ~500 productos sin virtualización; recetas y audit log llegan a límite con miles de filas
- **Acción:** migrar Catalog y AuditLog a TanStack Table (sort, filter, virtualization)
- **Estimado:** 1 día — diferible hasta Fase 5

**DT-007: Forms imperativos sin React Hook Form** ✅ RESUELTO 2026-04-27 (Bloque 5)
- ~~`react-hook-form` declarado pero no usado~~
- ~~LoginPage usa `useState` para campos~~
- Resolución: introducido `useZodForm` hook + `<FormField>` component, LoginPage migrada, los 5 forms de movements nacen con RHF + Zod resolver. `@hookform/resolvers@^3.9.0` agregado (la v5 requiere zod v4).

**DT-008: `@brasa/config` sin contenido**
- Carpeta declarada como workspace, sin `package.json` ni archivos
- ESLint configs duplicados en cada package
- **Acción:** crear `packages/config/eslint-preset.js` + `tsconfig.base.json` y consumirlos
- **Estimado:** 0.5 día

### 🟢 Baja — diferible

**DT-009: OpenAPI schemas incompletos en algunas rutas**
- Algunos endpoints no declaran `body`/`response` en su `schema:` Fastify
- Swagger UI funciona pero sin validación rigurosa de input por AJV (Zod sí valida internamente)
- **Acción:** completar schemas para que Swagger UI pre-rellene formularios y AJV agregue una capa extra de validación
- **Estimado:** 1 día

**DT-010: Diff visual estructurado en AuditLog**
- Hoy muestra `JSON.stringify(diffJson)`
- Ideal: lib `react-diff-viewer-continued` o similar
- **Estimado:** 0.5 día — diferible

**DT-011: Carpeta `outputs/` y `COMMIT_MESSAGE.txt` en repo**
- `COMMIT_MESSAGE.txt` ya cumplió su propósito (commit inicial), puede borrarse o moverse a `docs/CHANGELOG-initial.md`
- **Estimado:** trivial

---

## 7. PRD actualizado (basado en código real)

### 7.1 Visión

Brasa Brava es un **sistema de inventario y auditoría para una operación de parrilla de eventos**, con migración explícita de un Excel histórico (`Plantilla Mauricio final.xlsm`) que contenía 83 ingredientes, 37 recetas (33 importables) y 3 menús (Americana, Argentina, Tica). El sistema reemplaza VLOOKUP+SUM del Excel con cálculo recursivo (CTE) preservando la trazabilidad y permitiendo escalar a múltiples sucursales.

### 7.2 Personas

| Rol | Permisos clave | Casos de uso primarios |
|---|---|---|
| **ADMIN** | Wildcard `*` | Gestión catálogo, recetas, almacenes, usuarios, parametrización |
| **AUDITOR** | Lectura todo + ejecutar+conciliar auditorías | Conteo físico, conciliación, reportes |
| **OPERATOR** | Lectura todo + registrar movements + resolver alertas | Operación diaria: compras, consumos, mermas |
| **VIEWER** | Solo lectura | Consultas, dashboards |

### 7.3 Capacidades core (lo que el sistema HACE hoy en producción local)

1. **Cálculo de costos por receta**: dado el catálogo (≥66 productos con costo válido) y las 33 recetas con líneas, devuelve el costo por porción con recursión sobre sub-recetas (validado: ₡107.44 = 2148.77/20 contra Excel original).
2. **Multi-tenant a nivel DB**: una sola fila en `tenants` hoy ("BRASA_BRAVA"), pero RLS garantiza que `INSERT INTO tenants` con datos de otra sucursal queda completamente aislado sin tocar código.
3. **Audit trail inmutable**: cada mutación (productos, recetas, categorías, alias, archivado) deja entrada en `audit_log` con `before/after/diff`. La inmutabilidad se aplica a nivel DB con triggers + grants revocados al rol app.
4. **Optimistic concurrency**: dos usuarios editando el mismo producto/receta simultáneamente reciben `409 PRODUCT_VERSION_CONFLICT` el segundo en grabar.
5. **Bilingüismo en vivo**: switch ES/EN sin recarga preserva estado de filtros y formularios (validado por diseño de React Hook Form).
6. **Inventario operacional (backend)**: registro de movimientos PURCHASE/CONSUMPTION/WASTE/TRANSFER/ADJUSTMENT, proyección automática de `stock_levels` con weighted average (PWAC), alertas auto-generadas por trigger DB cuando `qty_on_hand < reorder_point`.

### 7.4 Capacidades NO disponibles aún

- UI para crear/editar productos, recetas, categorías, almacenes
- UI completa de inventario (vista stock + registrar movements)
- Service events (planificación + ejecución de un evento concreto)
- Auditorías físicas (conteo, conciliación, reportes P&L)
- Gestión de usuarios y roles desde UI
- MFA real (solo stub)
- Procurement (órdenes de compra, proveedores, recepciones)

### 7.5 Restricciones técnicas relevantes

- Postgres ≥16 obligatorio (uso de columnas generadas, RLS forzado, CTE recursivo)
- Frontend SPA (no SSR) — nginx en prod
- Sin almacenamiento de archivos binarios todavía (no hay fotos de productos ni evidencia de auditoría)
- Sin notificaciones push (solo in-app via consulta GET /alerts)
- Email transaccional via SMTP (MailHog en dev, SES/Resend pendiente para prod)

---

## 8. Plan de fases por delante

### Fase 3 — Inventario (en curso)

**Estado:** Bloques 1-5 completos. Bloques 6-7 pendientes.

#### Bloque 4 — Frontend warehouses + inventario ✅ CERRADO 2026-04-27

**Objetivo:** que el operario pueda ver stock por almacén y la valorización total sin tocar curl.

**Archivos a crear:**
- `apps/web/src/pages/WarehousesPage.tsx`
- `apps/web/src/pages/InventoryPage.tsx`
- `apps/web/src/i18n/locales/{es,en}/inventory.json`

**Archivos a modificar:**
- `apps/web/src/lib/queries.ts` — agregar `useWarehouses`, `useStock`, `useStockValuation`
- `apps/web/src/components/layout/Sidebar.tsx` — quitar `disabled` de `inventory` y `warehouses`
- `apps/web/src/App.tsx` — agregar rutas `/warehouses`, `/inventory`
- `apps/web/src/i18n/index.ts` — agregar namespace `inventory`

**Tareas en orden:**
1. Hooks de query nuevos (5 min)
2. Traducciones ES/EN namespace inventory (15 min)
3. WarehousesPage con cards (cada warehouse con itemsCount, totalValueCRC, openAlertsCount, click → drill al inventory filtrado) (1.5 h)
4. InventoryPage con tabla por warehouse: producto, qty, costo unit, valorización, días cobertura, estado (OK/bajo/crítico/negativo) (3 h)
5. Filtros: solo bajos, solo negativos, por categoría (45 min)

**Criterio de éxito:**
- Login → click "Almacenes" en sidebar → ver 3 cards con métricas
- Click en COCINA → InventoryPage filtrada con stock vivo del seed (productos con compras registradas vía curl previo)
- Switch ES/EN cambia toda la UI sin perder almacén seleccionado

#### Bloque 5 — Frontend movimientos ✅ CERRADO 2026-04-27

**Objetivo:** registrar compras, consumos, mermas, transferencias y ajustes desde UI.

**Archivos a crear:**
- `apps/web/src/pages/MovementsPage.tsx` (libro mayor)
- `apps/web/src/components/movements/RegisterMovementDrawer.tsx` (drawer reutilizable con tabs por tipo)
- `apps/web/src/components/movements/PurchaseForm.tsx`
- `apps/web/src/components/movements/ConsumptionForm.tsx`
- `apps/web/src/components/movements/WasteForm.tsx`
- `apps/web/src/components/movements/TransferForm.tsx`
- `apps/web/src/components/movements/AdjustmentForm.tsx`

**Tareas:**
1. Resolver DT-007 primero: instalar y wireear React Hook Form como base de los forms (0.5 día)
2. Drawer reutilizable con tabs (1 h)
3. 5 forms con validación Zod compartida desde `@brasa/shared-types` (4 h)
4. MovementsPage con tabla paginada (filtros por warehouse/product/type/fechas) (2 h)
5. Botón "Registrar movimiento" en InventoryPage abre drawer con producto pre-seleccionado (30 min)

**Criterio de éxito:**
- Operario registra compra de 17000ml de aceite → tabla de inventory refresca instantáneamente con qty=17000 y avg_unit_cost actualizado
- Registra consumo de 3000ml → stock baja a 14000ml
- Si configura reorder_point=15000, el consumo dispara alerta visible en sidebar (badge rojo)

#### Bloque 6 — Frontend alertas (ServiceEvents diferidos a Fase 4 por F3-D3) ✅ CERRADO 2026-04-27

**Objetivo:** completar Fase 3 con la bandeja de alertas operable y permitir planificar/ejecutar service events.

**Archivos a crear:**
- `apps/web/src/pages/AlertsPage.tsx`
- `apps/web/src/pages/ServiceEventsPage.tsx`
- `apps/api/src/application/commands/service-event-commands.ts`
- `apps/api/src/application/queries/list-service-events.query.ts`
- `apps/api/src/infrastructure/http/routes/service-event.routes.ts`
- `packages/shared-types/src/service-event.ts`

**Tareas backend (~1 día):**
1. Endpoints `POST /service-events`, `GET /service-events`, `PATCH /service-events/:id/execute`, `PATCH /service-events/:id/cancel`
2. Decisión C2: execute solo cambia estado, NO descuenta. Operario hace consumos manuales después.

**Tareas frontend (~1 día):**
1. AlertsPage inbox: cards con producto, almacén, qty actual vs reorder_point, fecha, botón resolver
2. ServiceEventsPage lista por fecha + form crear (menu + comensales + fecha + warehouse)
3. Toggle "Mostrar resueltas" en alerts

**Criterio de éxito:**
- Crear evento "Boda 50 personas, menu Argentina" → aparece en lista PLANNED
- Marcar EXECUTED → estado cambia, **stock NO se mueve** (decisión C2 explícita)
- Operario va a InventoryPage y registra consumos manuales según lo que realmente sacó de la cocina
- Alerta auto-creada por consumo aparece en bandeja, se resuelve con notas

#### Bloque 7 — Resolver deuda Fase 3

**Tareas:**
1. **DT-001 (Fastify 4→5)** — upgrade ecosistema. Tests E2E nuevos (DT-003 parcial)
2. **DT-004 (job nocturno)** — BullMQ + Redis worker que llama `recalc_avg_daily_consumption()` para todos los productos activos
3. **DT-007 (RHF)** — refactor de LoginPage como ejemplo, base para forms de Fases siguientes
4. **DT-002 (MFA TOTP)** — `otplib` + endpoints enroll/confirm + UI `/auth/mfa/setup`

**Criterio de éxito Fase 3 cerrada:**
- `pnpm audit --prod --audit-level high` pasa sin `continue-on-error`
- Days coverage muestra valores reales en stock view después de un día de movimientos
- ADMIN puede activar MFA en su perfil y el siguiente login pide TOTP real
- Cobertura de tests del backend supera 30%

---

### Fase 4 — Auditorías y conciliación

**Objetivo:** que el equipo pueda hacer auditorías físicas (FULL/CATEGORY/SPOT/CUSTOM), conciliarlas y emitir reportes P&L.

**Pre-requisitos:** Fase 3 cerrada (necesita `stock_levels` poblado por movimientos reales).

**Backend:**
- `apps/api/src/application/commands/audit-commands.ts` — start, count, reconcile, close, cancel
- `apps/api/src/application/queries/audit-queries.ts` — list, detail, P&L
- `apps/api/src/infrastructure/http/routes/audit.routes.ts`
- Conciliación = generación atómica de N `stock_movements` tipo `ADJUSTMENT` con `reference_type='AUDIT'` para cada `audit_count` con `variance != 0`

**Frontend:**
- `apps/web/src/pages/AuditsPage.tsx`
- `apps/web/src/pages/AuditCountPage.tsx` — UI tablet-friendly: producto, qty esperada, input qty contada, swipe/tap
- `apps/web/src/pages/AuditReportPage.tsx` — P&L por categoría + reason_code, export PDF/XLSX

**Tareas en orden:**
1. Schema review (no requiere migración nueva — modelos ya existen en Fase 1)
2. Backend audit lifecycle (DRAFT → IN_PROGRESS → COUNTED → RECONCILED → CLOSED)
3. Backend P&L query (SUM variance_value por categoría, reason_code, etc.)
4. UI lista de auditorías
5. UI modo conteo (tablet)
6. UI reporte con export

**Criterio de éxito:**
- AUDITOR crea auditoría FULL de COCINA → sistema snapshot todo el stock_level → genera N audit_counts vacíos
- AUDITOR ingresa conteo físico desde tablet
- AUDITOR clickea "Conciliar" → sistema genera ADJUSTMENT por cada variance, marca audit como RECONCILED, no permite re-edición
- Reporte muestra varianza por categoría + valor en CRC
- Export PDF descarga correctamente

**Estimado:** ~2 semanas

---

### Fase 4.5 — ABC cycle counting + reportes

**Pre-requisito:** ≥90 días de movimientos reales en producción.

**Objetivo:** clasificar productos automáticamente en A/B/C según `consumption × unit_cost` y programar auditorías cíclicas (A semanal, B mensual, C trimestral).

**Tareas:**
1. Job nocturno que recalcula clasificación ABC (usa misma infra que DT-004)
2. Schema: `products.abc_class char(1)` (A/B/C)
3. `audits.scope_type='ABC_CYCLE'` ya soportado, falta el filtro `{abc_class: 'A'}`
4. UI: scheduler de auditorías con cron expressions
5. Notificación in-app cuando una audit cíclica está vencida

**Estimado:** ~1 semana

---

### Fase 5 — Hardening, RBAC granular, deploy

**Objetivo:** sistema listo para producción real (no solo local dev).

**Tareas:**
1. Gestión usuarios + roles desde UI admin
2. Auditoría completa de permisos (matriz endpoint × rol)
3. Rate limiting endpoint-específico (login más estricto)
4. Account lockout (5 intentos fallidos = 15 min lock)
5. Email templates (Resend o AWS SES)
6. Resolver DT-005: imagen Docker prod testeada en CI
7. Resolver DT-006: TanStack Table con virtualización
8. Resolver DT-009: OpenAPI completo
9. Documentación de operaciones: runbook, backup, restore, seed reset
10. Pen-test interno básico
11. Métricas Prometheus + dashboards Grafana

**Estimado:** ~1.5 semanas

---

### Fase 6 — Procurement (futura, no comprometida)

**Objetivo:** órdenes de compra formales, proveedores, recepción de mercadería.

Modelos nuevos: `suppliers`, `purchase_orders`, `purchase_order_lines`, `receipts`. PO se convierte en PURCHASE movement al recibir.

**Estimado:** ~2 semanas

---

## 9. Decisiones operativas (PO)

### Resueltas

| # | Decisión | Resolución (2026-04-27) |
|---|---|---|
| **F3-D1** | ¿`react-hook-form` ya o seguimos con `useState`? | ✅ RHF ya — se introduce en Bloque 5 con LoginPage como primer migrador |
| **F3-D2** | ¿Bloque 5 hace los 5 movements de una o solo PURCHASE+CONSUMPTION? | ✅ Los 5 — orden: PURCHASE → CONSUMPTION/WASTE/ADJUSTMENT (paralelo) → TRANSFER al final |
| **F3-D3** | ¿Service events en Fase 3 o se difiere a Fase 4? | ✅ Diferir a Fase 4 — pareado con auditorías cuando tenga utilidad real |
| **F4-D1** | ¿Reporte P&L exporta PDF, XLSX, o ambos? | ✅ Ambos — XLSX primero (uso del contador), PDF después como polish |

### Pendientes

_(ninguna por ahora — agregar acá si surge algo durante Bloque 5)_

---

## 10. Cómo usar este documento

- **Al cerrar cada bloque/fase**: actualizar la matriz §5 (movés filas de 🟡/❌ a ✅) y la sección §6 (eliminás items de deuda resueltos)
- **Antes de empezar un bloque**: re-leer §8 para la lista exacta de archivos y tareas
- **Si el PO te pide "¿qué falta?"**: §5 te lo dice fila por fila
- **Si el dev te pide "¿qué tocar?"**: §8 lo dice por archivo
- **Si surge una decisión nueva**: agregala como `Fx-Dy` en §9 con tu recomendación

Versionado: cuando cierre Fase 3, este archivo se renombra a `PLAN-v0.3.md` y nace `PLAN.md` v0.4 con el estado nuevo.

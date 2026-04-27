# Security

## Reporting a vulnerability

Si encontrás una vulnerabilidad en el sistema, por favor reportala
**en privado** a victorjpalaciosg@gmail.com — no abras un issue público.

Tiempo de respuesta esperado: 72 horas hábiles.

## Known issues / pending upgrades

### SECURITY-001: Fastify 4 → 5 ecosystem upgrade

**Estado:** Planificado para Fase 3.
**Severidad:** High (no crítico explotable en producción).
**Workaround actual:** `pnpm audit` se ejecuta en CI pero como `continue-on-error`.

**Detalle:**

- `fast-jwt <6.2.0` (transitive vía `@fastify/jwt@8.0.1`) tiene dos CVEs:
  - GHSA-mvf2-f6gm-w987: Algorithm confusion via whitespace-prefixed RSA public key
  - GHSA-rp9m-7r4c-75qg: Cache confusion via cacheKeyBuilder collisions
- `fastify <5.7.2`: Content-Type header tab character allows body validation bypass

**Mitigación operativa actual:**
- No usamos `crit` headers en JWTs ni cache builder customizado → escenarios
  de explotación específicos no aplican a nuestro uso
- Todas las claves JWT son HS256 con secret de 64 bytes → sin riesgo de
  algorithm confusion entre HS y RS
- Content-Type bypass mitigado por validación Zod en cada handler

**Plan de upgrade:**

```
fastify ^4.29.1   → ^5.0.0
@fastify/jwt 8     → 9
@fastify/cookie 9  → 11
@fastify/cors 9    → 11
@fastify/helmet 11 → 13
@fastify/rate-limit 9 → 10
@fastify/swagger 8 → 9
@fastify/swagger-ui 4 → 5
```

Requiere ajustes en `apps/api/src/server.ts` (cambios menores en API de
plugins) y re-tests de integración.

## Security architecture

- **Authentication:** JWT HS256 access tokens (15 min) + refresh rotativo
  (7 días) con detección de reuse → revoke-all del usuario
- **Password hashing:** Argon2id (memory 19MB, time 2, parallelism 1) — OWASP 2023
- **Database:** Postgres Row-Level Security forzado en 17 tablas tenant-scoped
- **Audit log:** Inmutable a nivel DB (UPDATE/DELETE revocados al rol de
  aplicación + trigger defensivo). Toda mutación deja rastro con
  before/after/diff
- **Multi-tenant isolation:** `current_tenant_id()` setteado vía SET LOCAL
  dentro de cada transacción HTTP, RLS filtra automáticamente
- **HTTP hardening:** Helmet (CSP, HSTS, etc.), CORS configurado por env,
  rate-limit configurable
- **Cookies:** `httpOnly` + `Secure` + `SameSite=Strict` para refresh token
- **Secrets:** JWT secrets ≥32 chars validados al boot via Zod; nunca
  loggeados (Pino redact paths)

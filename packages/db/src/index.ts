/**
 * @brasa/db — Cliente Prisma compartido + helpers de tenant context.
 *
 * Uso típico desde el API:
 *   import { prisma, withTenantContext } from '@brasa/db';
 *
 *   await withTenantContext(prisma, { tenantId, userId }, async (tx) => {
 *     return tx.product.findMany();
 *   });
 *
 * El helper aplica `SET LOCAL app.current_tenant_id` y
 * `SET LOCAL app.current_user_id` dentro de la transacción, lo que
 * activa las RLS policies y el trigger de price_history.
 */

import { PrismaClient, Prisma } from '@prisma/client';

export * from '@prisma/client';

let _prisma: PrismaClient | undefined;

export const prisma: PrismaClient = (() => {
  if (_prisma) return _prisma;
  _prisma = new PrismaClient({
    log:
      process.env.NODE_ENV === 'production'
        ? ['error', 'warn']
        : ['query', 'error', 'warn'],
  });
  return _prisma;
})();

export interface TenantContext {
  tenantId: string;
  userId?: string | undefined;
}

/**
 * Ejecuta `fn` dentro de una transacción con el contexto de tenant aplicado
 * vía `SET LOCAL`. Garantiza que las RLS policies filtren correctamente.
 *
 * No usar para conexiones admin (migrations, seed): esas usan el rol de DB
 * con BYPASSRLS o se ejecutan antes de habilitar RLS.
 */
export async function withTenantContext<T>(
  client: PrismaClient,
  ctx: TenantContext,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  if (!isUuid(ctx.tenantId)) {
    throw new Error(`Invalid tenantId: ${ctx.tenantId}`);
  }
  if (ctx.userId !== undefined && !isUuid(ctx.userId)) {
    throw new Error(`Invalid userId: ${ctx.userId}`);
  }

  return client.$transaction(async (tx) => {
    // SET LOCAL solo afecta a la transacción actual, se revierte al COMMIT/ROLLBACK
    await tx.$executeRawUnsafe(
      `SELECT set_config('app.current_tenant_id', $1, true)`,
      ctx.tenantId,
    );
    if (ctx.userId) {
      await tx.$executeRawUnsafe(
        `SELECT set_config('app.current_user_id', $1, true)`,
        ctx.userId,
      );
    }
    return fn(tx);
  });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuid(v: string): boolean {
  return UUID_RE.test(v);
}

export async function disconnect(): Promise<void> {
  if (_prisma) {
    await _prisma.$disconnect();
    _prisma = undefined;
  }
}

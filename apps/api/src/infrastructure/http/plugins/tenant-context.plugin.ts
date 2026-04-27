/**
 * Tenant context: provee `req.db.tx(...)` que ejecuta queries dentro de
 * una transacción con `SET LOCAL app.current_tenant_id` y
 * `app.current_user_id`, activando RLS y triggers.
 */
import fp from 'fastify-plugin';
import { prisma, withTenantContext, type TenantContext } from '@brasa/db';
import type { Prisma } from '@brasa/db';
import { DomainError } from './error-handler.plugin.js';

export interface RequestDb {
  /** Ejecuta `fn` con tenant context aplicado. */
  tx<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T>;
}

export const tenantContextPlugin = fp(async (app) => {
  app.decorateRequest('db', null);

  app.addHook('onRequest', async (req) => {
    req.db = {
      tx: async (fn) => {
        const auth = req.auth;
        if (!auth) {
          throw new DomainError('UNAUTHORIZED', 401);
        }
        const ctx: TenantContext = { tenantId: auth.tenantId, userId: auth.userId };
        return withTenantContext(prisma, ctx, fn);
      },
    };
  });

  // Cliente sin tenant context (solo para auth.routes — login, refresh)
  app.decorate('rawPrisma', prisma);
});

declare module 'fastify' {
  interface FastifyRequest {
    db: RequestDb;
  }
  interface FastifyInstance {
    rawPrisma: typeof prisma;
  }
}

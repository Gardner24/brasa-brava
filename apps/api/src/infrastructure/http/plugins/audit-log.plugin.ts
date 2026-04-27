/**
 * Audit log de eventos HTTP relevantes (login, logout, exports, mutaciones
 * con marca explícita). Las inserciones más detalladas (UPDATE de productos
 * con before/after) se hacen en los handlers de comando de cada feature, no
 * acá — para evitar inflar el log con noise.
 */
import fp from 'fastify-plugin';
import { prisma } from '@brasa/db';

export interface AuditLogEntry {
  tenantId?: string | undefined;
  actorId?: string | undefined;
  actorEmail: string;
  entity: string;
  entityId: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGIN_FAILED' | 'LOGOUT' | 'EXPORT';
  beforeJson?: unknown;
  afterJson?: unknown;
  diffJson?: unknown;
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
  requestId?: string | undefined;
}

export const auditLogPlugin = fp(async (app) => {
  app.decorate('audit', {
    async record(entry: AuditLogEntry): Promise<void> {
      try {
        await prisma.auditLog.create({
          data: {
            tenantId: entry.tenantId ?? null,
            actorId: entry.actorId ?? null,
            actorEmail: entry.actorEmail,
            entity: entry.entity,
            entityId: entry.entityId,
            action: entry.action,
            beforeJson: entry.beforeJson as never,
            afterJson: entry.afterJson as never,
            diffJson: entry.diffJson as never,
            ipAddress: entry.ipAddress ?? null,
            userAgent: entry.userAgent ?? null,
            requestId: entry.requestId ?? null,
          },
        });
      } catch (err) {
        // Audit log es crítico pero no debe tumbar la operación principal.
        // Loggeamos en Pino para que se rescate en el sistema de logs.
        app.log.error({ err, entry }, 'audit_log insertion failed');
      }
    },
  });
});

declare module 'fastify' {
  interface FastifyInstance {
    audit: { record: (entry: AuditLogEntry) => Promise<void> };
  }
}

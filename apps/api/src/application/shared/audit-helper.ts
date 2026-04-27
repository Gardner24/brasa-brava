/**
 * Helper para registrar mutaciones en audit_log con before/after y diff.
 * Mantiene la lógica fuera de cada command para no duplicar.
 */
import type { FastifyInstance } from 'fastify';

export interface AuditMutationContext {
  app: FastifyInstance;
  tenantId: string;
  actorId: string;
  actorEmail: string;
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
  requestId?: string | undefined;
}

/** Acción discreta sobre una entidad. */
export type AuditAction = 'INSERT' | 'UPDATE' | 'DELETE';

export async function recordMutation(
  ctx: AuditMutationContext,
  args: {
    entity: string;
    entityId: string;
    action: AuditAction;
    before?: unknown;
    after?: unknown;
  },
): Promise<void> {
  await ctx.app.audit.record({
    tenantId: ctx.tenantId,
    actorId: ctx.actorId,
    actorEmail: ctx.actorEmail,
    entity: args.entity,
    entityId: args.entityId,
    action: args.action,
    beforeJson: args.before,
    afterJson: args.after,
    diffJson: computeDiff(args.before, args.after),
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
    requestId: ctx.requestId,
  });
}

/**
 * Diff plano: lista campos cambiados con {field, before, after}.
 * No es JSON-Patch RFC 6902 — es legible y suficiente para auditoría humana.
 * Si en algún momento queremos diff jerárquico (jsonb anidado), migramos a una lib.
 */
export function computeDiff(before: unknown, after: unknown): unknown {
  if (before == null && after == null) return null;
  if (before == null) return { type: 'created', after };
  if (after == null) return { type: 'deleted', before };

  if (typeof before !== 'object' || typeof after !== 'object') {
    return before === after ? null : { before, after };
  }

  const b = before as Record<string, unknown>;
  const a = after as Record<string, unknown>;
  const changes: Array<{ field: string; before: unknown; after: unknown }> = [];

  const keys = new Set([...Object.keys(b), ...Object.keys(a)]);
  for (const key of keys) {
    if (!deepEqual(b[key], a[key])) {
      changes.push({ field: key, before: b[key] ?? null, after: a[key] ?? null });
    }
  }
  return changes.length ? { type: 'updated', changes } : null;
}

function deepEqual(x: unknown, y: unknown): boolean {
  if (x === y) return true;
  if (x == null || y == null) return false;
  if (typeof x !== typeof y) return false;
  if (typeof x !== 'object') return false;
  return JSON.stringify(x) === JSON.stringify(y);
}

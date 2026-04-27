/**
 * Marca una alerta como resuelta. Idempotente: si ya estaba resuelta,
 * devuelve error explícito (no la "re-resuelve" silenciosamente).
 *
 * El trigger DB también auto-resuelve cuando el stock recupera el nivel,
 * así que esta acción manual sirve para casos como "ya hicimos el pedido
 * pero todavía no llegó" — el operario marca con notas y queda registrado.
 */
import type { Prisma } from '@brasa/db';
import { DomainError } from '../../infrastructure/http/plugins/error-handler.plugin.js';
import { recordMutation, type AuditMutationContext } from '../shared/audit-helper.js';

export async function resolveAlert(
  tx: Prisma.TransactionClient,
  ctx: AuditMutationContext,
  alertId: string,
  notes?: string,
): Promise<void> {
  const alert = await tx.lowStockAlert.findUnique({ where: { id: alertId } });
  if (!alert) throw new DomainError('NOT_FOUND', 404);
  if (alert.resolvedAt) {
    throw new DomainError('ALERT_ALREADY_RESOLVED', 409, {
      resolvedAt: alert.resolvedAt.toISOString(),
    });
  }

  await tx.lowStockAlert.update({
    where: { id: alertId },
    data: {
      resolvedAt: new Date(),
      resolvedById: ctx.actorId,
    },
  });

  await recordMutation(ctx, {
    entity: 'low_stock_alert',
    entityId: alertId,
    action: 'UPDATE',
    before: { resolvedAt: null },
    after: { resolvedAt: new Date().toISOString(), notes: notes ?? null },
  });
}

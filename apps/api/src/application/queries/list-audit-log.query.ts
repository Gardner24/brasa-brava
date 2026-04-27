/**
 * Lectura paginada y filtrable del audit_log.
 *
 * IMPORTANTE: este endpoint NO usa req.db.tx() (con tenant context vía RLS)
 * porque audit_log puede tener filas con tenant_id NULL (LOGIN_FAILED antes
 * de identificar al user, etc.). Usamos prisma raw + filtramos por tenant
 * explícitamente en el WHERE.
 *
 * Solo accesible con permiso 'audit_log.read' o wildcard. Por defecto
 * únicamente ADMIN tiene este permiso.
 */
import type { Prisma, PrismaClient } from '@brasa/db';
import type { AuditLogEntryDTO, ListAuditLogQuery } from '@brasa/shared-types';

export interface ListAuditLogResult {
  data: AuditLogEntryDTO[];
  page: number;
  pageSize: number;
  total: number;
}

export async function listAuditLog(
  prisma: PrismaClient | Prisma.TransactionClient,
  tenantId: string,
  q: ListAuditLogQuery,
): Promise<ListAuditLogResult> {
  const where: Prisma.AuditLogWhereInput = {
    OR: [{ tenantId }, { tenantId: null }],
  };
  if (q.entity) where.entity = q.entity;
  if (q.entityId) where.entityId = q.entityId;
  if (q.actorId) where.actorId = q.actorId;
  if (q.action) where.action = q.action;
  if (q.fromDate || q.toDate) {
    where.occurredAt = {
      ...(q.fromDate ? { gte: new Date(q.fromDate) } : {}),
      ...(q.toDate ? { lte: new Date(q.toDate) } : {}),
    };
  }

  const [total, rows] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { occurredAt: 'desc' },
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    }),
  ]);

  const data: AuditLogEntryDTO[] = rows.map((r) => ({
    id: r.id,
    occurredAt: r.occurredAt.toISOString(),
    actorId: r.actorId,
    actorEmail: r.actorEmail,
    entity: r.entity,
    entityId: r.entityId,
    action: r.action,
    beforeJson: r.beforeJson,
    afterJson: r.afterJson,
    diffJson: r.diffJson,
    ipAddress: r.ipAddress,
    requestId: r.requestId,
  }));

  return { data, page: q.page, pageSize: q.pageSize, total };
}

import { z } from 'zod';
import { UUID } from './common.js';

export const AuditLogEntryDTO = z.object({
  id: UUID,
  occurredAt: z.string().datetime(),
  actorId: UUID.nullable(),
  actorEmail: z.string(),
  entity: z.string(),
  entityId: UUID,
  action: z.string(),
  beforeJson: z.unknown().nullable(),
  afterJson: z.unknown().nullable(),
  diffJson: z.unknown().nullable(),
  ipAddress: z.string().nullable(),
  requestId: UUID.nullable(),
});
export type AuditLogEntryDTO = z.infer<typeof AuditLogEntryDTO>;

export const ListAuditLogQuery = z.object({
  entity: z.string().max(60).optional(),
  entityId: UUID.optional(),
  actorId: UUID.optional(),
  action: z.string().max(20).optional(),
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});
export type ListAuditLogQuery = z.infer<typeof ListAuditLogQuery>;

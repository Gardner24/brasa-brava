/**
 * CRUD warehouses. Admin-only.
 *
 * Reglas:
 *  - code único por tenant (FK constraint)
 *  - DELETE bloqueado si hay stock vivo en el almacén (decisión segura).
 *    Para descomisionar de verdad, el flujo correcto es: transferir todo
 *    a otro almacén → setear isActive=false → DELETE solo si limpio.
 */
import { Prisma } from '@brasa/db';
import type { CreateWarehouseRequest, UpdateWarehouseRequest, WarehouseDTO } from '@brasa/shared-types';
import { DomainError } from '../../infrastructure/http/plugins/error-handler.plugin.js';
import { recordMutation, type AuditMutationContext } from '../shared/audit-helper.js';

function toDTO(w: {
  id: string;
  code: string;
  displayName: string;
  isActive: boolean;
  createdAt: Date;
}): WarehouseDTO {
  return {
    id: w.id,
    code: w.code,
    displayName: w.displayName,
    isActive: w.isActive,
    itemsCount: 0,
    totalValueCRC: 0,
    openAlertsCount: 0,
    createdAt: w.createdAt.toISOString(),
  };
}

export async function createWarehouse(
  tx: Prisma.TransactionClient,
  ctx: AuditMutationContext,
  input: CreateWarehouseRequest,
): Promise<WarehouseDTO> {
  try {
    const created = await tx.warehouse.create({
      data: {
        tenantId: ctx.tenantId,
        code: input.code,
        displayName: input.displayName,
      },
    });
    const dto = toDTO(created);
    await recordMutation(ctx, {
      entity: 'warehouse',
      entityId: created.id,
      action: 'INSERT',
      after: dto,
    });
    return dto;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new DomainError('WAREHOUSE_CODE_TAKEN', 409, { code: input.code });
    }
    throw err;
  }
}

export async function updateWarehouse(
  tx: Prisma.TransactionClient,
  ctx: AuditMutationContext,
  warehouseId: string,
  input: UpdateWarehouseRequest,
): Promise<WarehouseDTO> {
  const current = await tx.warehouse.findUnique({ where: { id: warehouseId } });
  if (!current) throw new DomainError('NOT_FOUND', 404);

  const updated = await tx.warehouse.update({
    where: { id: warehouseId },
    data: {
      ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    },
  });

  await recordMutation(ctx, {
    entity: 'warehouse',
    entityId: warehouseId,
    action: 'UPDATE',
    before: toDTO(current),
    after: toDTO(updated),
  });
  return toDTO(updated);
}

export async function deleteWarehouse(
  tx: Prisma.TransactionClient,
  ctx: AuditMutationContext,
  warehouseId: string,
): Promise<void> {
  const current = await tx.warehouse.findUnique({ where: { id: warehouseId } });
  if (!current) throw new DomainError('NOT_FOUND', 404);

  const stockCount = await tx.stockLevel.count({
    where: { warehouseId, qtyOnHand: { gt: 0 } },
  });
  if (stockCount > 0) {
    throw new DomainError('WAREHOUSE_HAS_STOCK', 409, { itemsWithStock: stockCount });
  }

  await tx.warehouse.delete({ where: { id: warehouseId } });
  await recordMutation(ctx, {
    entity: 'warehouse',
    entityId: warehouseId,
    action: 'DELETE',
    before: toDTO(current),
  });
}

/**
 * Editar producto con OPTIMISTIC CONCURRENCY.
 *
 * Reglas:
 *  - Cliente envía expectedVersion. Si no coincide → 409 PRODUCT_VERSION_CONFLICT.
 *  - Si cambia package_cost o package_size, se inserta fila en price_history (vía
 *    el trigger de DB que ya tenemos, pero también explícitamente acá para tener
 *    control del `source`).
 *  - dataQualityIssue se recalcula automáticamente según los valores resultantes.
 *  - Audit log: UPDATE con before/after/diff.
 */
import { Prisma, type Product, type ProductCategory } from '@brasa/db';
import type { UpdateProductRequest, ProductDTO } from '@brasa/shared-types';
import { DomainError } from '../../infrastructure/http/plugins/error-handler.plugin.js';
import { recordMutation, type AuditMutationContext } from '../shared/audit-helper.js';
import { toProductDTO } from '../shared/product-mapper.js';

export async function updateProduct(
  tx: Prisma.TransactionClient,
  ctx: AuditMutationContext,
  productId: string,
  input: UpdateProductRequest,
): Promise<ProductDTO> {
  const current = await tx.product.findUnique({
    where: { id: productId },
    include: { category: { select: { id: true, code: true } } },
  });
  if (!current) throw new DomainError('NOT_FOUND', 404);
  if (current.version !== input.expectedVersion) {
    throw new DomainError('PRODUCT_VERSION_CONFLICT', 409, {
      expectedVersion: input.expectedVersion,
      currentVersion: current.version,
    });
  }

  // Resolver categoría si vino code
  let nextCategoryId: string = current.categoryId;
  if (input.categoryCode && input.categoryCode !== current.category.code) {
    const cat = await tx.productCategory.findUnique({
      where: { tenantId_code: { tenantId: ctx.tenantId, code: input.categoryCode } },
    });
    if (!cat) throw new DomainError('CATEGORY_NOT_FOUND', 404, { code: input.categoryCode });
    nextCategoryId = cat.id;
  }

  const nextPackageCost = input.packageCost === undefined
    ? current.packageCost == null ? null : Number(current.packageCost)
    : input.packageCost;
  const nextPackageSize = input.packageSize === undefined
    ? current.packageSize == null ? null : Number(current.packageSize)
    : input.packageSize;

  const dataQualityIssue = computeDataQuality(nextPackageCost, nextPackageSize);

  // UPDATE con check de version. Prisma no expone WHERE compuesto en update,
  // así que usamos updateMany y validamos count.
  const result = await tx.product.updateMany({
    where: { id: productId, version: input.expectedVersion },
    data: {
      ...(input.name !== undefined ? { name: input.name as unknown as Prisma.InputJsonValue } : {}),
      categoryId: nextCategoryId,
      ...(input.baseUnit !== undefined ? { baseUnit: input.baseUnit } : {}),
      ...(input.packageSize !== undefined ? { packageSize: input.packageSize } : {}),
      ...(input.packageCost !== undefined ? { packageCost: input.packageCost } : {}),
      ...(input.reorderPoint !== undefined ? { reorderPoint: input.reorderPoint } : {}),
      ...(input.reorderQty !== undefined ? { reorderQty: input.reorderQty } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : { isActive: dataQualityIssue !== 'MISSING_COST' }),
      dataQualityIssue,
      version: { increment: 1 },
    },
  });
  if (result.count === 0) {
    // Race condition justo después del check
    throw new DomainError('PRODUCT_VERSION_CONFLICT', 409, {
      expectedVersion: input.expectedVersion,
    });
  }

  // Si el costo cambió, registrar en price_history con source explícito
  const costChanged =
    input.packageCost !== undefined && Number(current.packageCost ?? 0) !== input.packageCost;
  const sizeChanged =
    input.packageSize !== undefined && Number(current.packageSize ?? 0) !== input.packageSize;
  if ((costChanged || sizeChanged) && nextPackageCost != null && nextPackageSize != null) {
    await tx.productPriceHistory.create({
      data: {
        productId,
        packageCost: nextPackageCost,
        packageSize: nextPackageSize,
        source: 'manual:update',
        createdById: ctx.actorId,
      },
    });
  }

  const fresh = await tx.product.findUniqueOrThrow({
    where: { id: productId },
    include: { category: { select: { code: true } } },
  });
  const after = toProductDTO(fresh);
  const before = toProductDTO({ ...current, category: { code: current.category.code } } as Product & { category: { code: string } });

  await recordMutation(ctx, {
    entity: 'product',
    entityId: productId,
    action: 'UPDATE',
    before,
    after,
  });

  return after;
}

function computeDataQuality(
  cost: number | null | undefined,
  size: number | null | undefined,
): 'MISSING_COST' | 'MISSING_PACKAGE_SIZE' | null {
  if (cost == null) return 'MISSING_COST';
  if (size == null) return 'MISSING_PACKAGE_SIZE';
  return null;
}

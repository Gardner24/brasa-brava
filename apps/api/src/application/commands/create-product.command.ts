/**
 * Crear producto.
 * Reglas:
 *  - SKU único por tenant (validado por DB con índice + manejado en error handler)
 *  - Categoría debe existir (resolución por code)
 *  - Si se provee package_size + package_cost, se inicia el price_history
 *  - Audit log: INSERT con afterJson
 */
import type { Prisma } from '@brasa/db';
import type { CreateProductRequest, ProductDTO } from '@brasa/shared-types';
import { DomainError } from '../../infrastructure/http/plugins/error-handler.plugin.js';
import { recordMutation, type AuditMutationContext } from '../shared/audit-helper.js';
import { toProductDTO } from '../shared/product-mapper.js';

export async function createProduct(
  tx: Prisma.TransactionClient,
  ctx: AuditMutationContext,
  input: CreateProductRequest,
): Promise<ProductDTO> {
  const category = await tx.productCategory.findUnique({
    where: { tenantId_code: { tenantId: ctx.tenantId, code: input.categoryCode } },
  });
  if (!category) throw new DomainError('CATEGORY_NOT_FOUND', 404, { code: input.categoryCode });

  const dataQualityIssue = computeDataQuality(input.packageCost, input.packageSize);

  const product = await tx.product.create({
    data: {
      tenantId: ctx.tenantId,
      sku: input.sku,
      name: input.name as unknown as Prisma.InputJsonValue,
      categoryId: category.id,
      baseUnit: input.baseUnit,
      packageSize: input.packageSize ?? null,
      packageCost: input.packageCost ?? null,
      reorderPoint: input.reorderPoint ?? null,
      reorderQty: input.reorderQty ?? null,
      notes: input.notes ?? null,
      isActive: dataQualityIssue !== 'MISSING_COST',
      dataQualityIssue: dataQualityIssue,
    },
    include: { category: { select: { code: true } } },
  });

  // Snapshot inicial de precio si hay datos completos
  if (input.packageSize != null && input.packageCost != null) {
    await tx.productPriceHistory.create({
      data: {
        productId: product.id,
        packageCost: input.packageCost,
        packageSize: input.packageSize,
        source: 'manual:create',
        createdById: ctx.actorId,
      },
    });
  }

  const dto = toProductDTO(product);
  await recordMutation(ctx, {
    entity: 'product',
    entityId: product.id,
    action: 'INSERT',
    after: dto,
  });
  return dto;
}

function computeDataQuality(
  cost: number | undefined,
  size: number | undefined,
): 'MISSING_COST' | 'MISSING_PACKAGE_SIZE' | null {
  if (cost == null) return 'MISSING_COST';
  if (size == null) return 'MISSING_PACKAGE_SIZE';
  return null;
}

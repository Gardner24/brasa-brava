/**
 * "Archivar" producto = soft delete vía `is_active = false`.
 *
 * Reglas (decisión B2):
 *  - Si el producto tiene movimientos de stock o líneas de receta activas,
 *    NO se archiva sin advertencia. Devolvemos PRODUCT_HAS_DEPENDENCIES con
 *    el conteo de cada dependencia.
 *  - El cliente puede forzar archivar pasando `force=true` (lo que solo lo
 *    saca de búsquedas, no rompe referencias históricas).
 */
import type { Prisma } from '@brasa/db';
import type { ProductDTO } from '@brasa/shared-types';
import { DomainError } from '../../infrastructure/http/plugins/error-handler.plugin.js';
import { recordMutation, type AuditMutationContext } from '../shared/audit-helper.js';
import { toProductDTO } from '../shared/product-mapper.js';

export interface ArchiveProductInput {
  expectedVersion: number;
  force?: boolean;
}

export async function archiveProduct(
  tx: Prisma.TransactionClient,
  ctx: AuditMutationContext,
  productId: string,
  input: ArchiveProductInput,
): Promise<ProductDTO> {
  const current = await tx.product.findUnique({
    where: { id: productId },
    include: { category: { select: { code: true } } },
  });
  if (!current) throw new DomainError('NOT_FOUND', 404);
  if (current.version !== input.expectedVersion) {
    throw new DomainError('PRODUCT_VERSION_CONFLICT', 409, {
      expectedVersion: input.expectedVersion,
      currentVersion: current.version,
    });
  }
  if (!current.isActive) {
    // Idempotencia: ya está archivado
    return toProductDTO(current);
  }

  if (!input.force) {
    const [movementsCount, recipeLinesCount] = await Promise.all([
      tx.stockMovement.count({ where: { productId } }),
      tx.recipeLine.count({ where: { productId } }),
    ]);
    if (movementsCount > 0 || recipeLinesCount > 0) {
      throw new DomainError('PRODUCT_HAS_DEPENDENCIES', 409, {
        movementsCount,
        recipeLinesCount,
      });
    }
  }

  const result = await tx.product.updateMany({
    where: { id: productId, version: input.expectedVersion },
    data: { isActive: false, version: { increment: 1 } },
  });
  if (result.count === 0) {
    throw new DomainError('PRODUCT_VERSION_CONFLICT', 409);
  }

  const fresh = await tx.product.findUniqueOrThrow({
    where: { id: productId },
    include: { category: { select: { code: true } } },
  });
  const after = toProductDTO(fresh);
  const before = toProductDTO(current);

  await recordMutation(ctx, {
    entity: 'product',
    entityId: productId,
    action: 'DELETE',
    before,
    after,
  });

  return after;
}

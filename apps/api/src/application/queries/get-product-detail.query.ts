/**
 * Query: detalle de un producto.
 * Incluye: aliases, últimos 20 puntos del histórico de precios,
 * conteo de uso en recetas activas.
 */
import type { Prisma } from '@brasa/db';
import type { ProductDetailDTO } from '@brasa/shared-types';
import { DomainError } from '../../infrastructure/http/plugins/error-handler.plugin.js';
import { toProductDTO } from '../shared/product-mapper.js';

export async function getProductDetail(
  tx: Prisma.TransactionClient,
  productId: string,
): Promise<ProductDetailDTO> {
  const product = await tx.product.findUnique({
    where: { id: productId },
    include: {
      category: { select: { code: true } },
      aliases: { orderBy: { createdAt: 'desc' } },
      priceHistory: {
        orderBy: { effectiveAt: 'desc' },
        take: 20,
      },
    },
  });
  if (!product) throw new DomainError('NOT_FOUND', 404);

  const usedInRecipesCount = await tx.recipeLine.count({
    where: { productId, recipe: { isActive: true } },
  });

  const dto = toProductDTO(product);
  return {
    ...dto,
    aliases: product.aliases.map((a) => ({ id: a.id, alias: a.alias })),
    priceHistory: product.priceHistory.map((h) => {
      const cost = Number(h.packageCost);
      const size = Number(h.packageSize);
      return {
        id: h.id,
        packageCost: cost,
        packageSize: size,
        unitCost: size > 0 ? cost / size : 0,
        effectiveAt: h.effectiveAt.toISOString(),
        source: h.source,
        createdById: h.createdById,
      };
    }),
    usedInRecipesCount,
  };
}

/**
 * Lista categorías con conteo de productos.
 * Devuelve todas (no paginado) — son ~9-15 categorías canónicas.
 */
import type { Prisma } from '@brasa/db';
import type { CategoryDTO } from '@brasa/shared-types';

export async function listCategories(tx: Prisma.TransactionClient): Promise<CategoryDTO[]> {
  const rows = await tx.productCategory.findMany({
    include: { _count: { select: { products: true } } },
    orderBy: [{ parentId: 'asc' }, { code: 'asc' }],
  });

  return rows.map((c) => ({
    id: c.id,
    code: c.code,
    displayName: c.displayName,
    description: c.description,
    parentId: c.parentId,
    productsCount: c._count.products,
    createdAt: c.createdAt.toISOString(),
  }));
}

/**
 * Query: listar productos paginados con filtros.
 * Capa de aplicación: orquesta la persistencia, no implementa SQL.
 */
import type { Prisma } from '@brasa/db';
import type { ListProductsQuery, ProductDTO } from '@brasa/shared-types';
import { toProductDTO } from '../shared/product-mapper.js';

export interface ListProductsResult {
  data: ProductDTO[];
  page: number;
  pageSize: number;
  total: number;
}

export async function listProducts(
  tx: Prisma.TransactionClient,
  q: ListProductsQuery,
): Promise<ListProductsResult> {
  const where: Prisma.ProductWhereInput = {};
  if (q.search) {
    where.OR = [
      { sku: { contains: q.search, mode: 'insensitive' } },
      // Buscar dentro del jsonb name (asume {es, en})
      { name: { path: ['es'], string_contains: q.search } as never },
      { name: { path: ['en'], string_contains: q.search } as never },
      // También buscar en aliases
      { aliases: { some: { alias: { contains: q.search, mode: 'insensitive' } } } },
    ];
  }
  if (q.categoryCode) {
    where.category = { code: q.categoryCode };
  }
  if (q.isActive !== undefined) {
    where.isActive = q.isActive;
  }
  if (q.dataQualityIssue) {
    where.dataQualityIssue = q.dataQualityIssue;
  }

  const [total, rows] = await Promise.all([
    tx.product.count({ where }),
    tx.product.findMany({
      where,
      include: { category: { select: { code: true } } },
      orderBy: [{ isActive: 'desc' }, { sku: 'asc' }],
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    }),
  ]);

  const data: ProductDTO[] = rows.map((p) => toProductDTO(p));

  return { data, page: q.page, pageSize: q.pageSize, total };
}

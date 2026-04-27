import type { Prisma } from '@brasa/db';
import type { ListRecipesQuery, RecipeDTO } from '@brasa/shared-types';
import { toRecipeDTO } from '../shared/recipe-mapper.js';

export interface ListRecipesResult {
  data: RecipeDTO[];
  page: number;
  pageSize: number;
  total: number;
}

export async function listRecipes(
  tx: Prisma.TransactionClient,
  q: ListRecipesQuery,
): Promise<ListRecipesResult> {
  const where: Prisma.RecipeWhereInput = {};
  if (q.search) {
    where.OR = [
      { code: { contains: q.search, mode: 'insensitive' } },
      { name: { path: ['es'], string_contains: q.search } as never },
      { name: { path: ['en'], string_contains: q.search } as never },
    ];
  }
  if (q.menuCode) {
    where.menuRecipes = { some: { menu: { code: q.menuCode } } };
  }
  if (q.isActive !== undefined) {
    where.isActive = q.isActive;
  }

  const [total, rows] = await Promise.all([
    tx.recipe.count({ where }),
    tx.recipe.findMany({
      where,
      include: { _count: { select: { lines: true } } },
      orderBy: [{ isActive: 'desc' }, { code: 'asc' }],
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    }),
  ]);

  return {
    data: rows.map((r) => toRecipeDTO(r)),
    page: q.page,
    pageSize: q.pageSize,
    total,
  };
}

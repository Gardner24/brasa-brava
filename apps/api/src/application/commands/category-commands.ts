/**
 * CRUD de categorías. Operaciones admin-only.
 *
 * Reglas:
 *  - Code es único por tenant (validado por DB)
 *  - parentId opcional para jerarquía (ADR-001 §3 lo previó)
 *  - parent debe ser del mismo tenant (RLS lo garantiza, pero validamos)
 *  - Borrar requiere: 0 productos asignados Y 0 categorías hijas
 */
import { Prisma } from '@brasa/db';
import type { CategoryDTO, CreateCategoryRequest, UpdateCategoryRequest } from '@brasa/shared-types';
import { DomainError } from '../../infrastructure/http/plugins/error-handler.plugin.js';
import { recordMutation, type AuditMutationContext } from '../shared/audit-helper.js';

function toDTO(c: {
  id: string;
  code: string;
  displayName: string;
  description: string | null;
  parentId: string | null;
  createdAt: Date;
}, productsCount = 0): CategoryDTO {
  return {
    id: c.id,
    code: c.code,
    displayName: c.displayName,
    description: c.description,
    parentId: c.parentId,
    productsCount,
    createdAt: c.createdAt.toISOString(),
  };
}

export async function createCategory(
  tx: Prisma.TransactionClient,
  ctx: AuditMutationContext,
  input: CreateCategoryRequest,
): Promise<CategoryDTO> {
  if (input.parentId) {
    const parent = await tx.productCategory.findUnique({ where: { id: input.parentId } });
    if (!parent) throw new DomainError('CATEGORY_PARENT_INVALID', 400);
  }

  try {
    const created = await tx.productCategory.create({
      data: {
        tenantId: ctx.tenantId,
        code: input.code,
        displayName: input.displayName,
        description: input.description ?? null,
        parentId: input.parentId ?? null,
      },
    });
    const dto = toDTO(created);
    await recordMutation(ctx, {
      entity: 'product_category',
      entityId: created.id,
      action: 'INSERT',
      after: dto,
    });
    return dto;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new DomainError('CATEGORY_CODE_TAKEN', 409, { code: input.code });
    }
    throw err;
  }
}

export async function updateCategory(
  tx: Prisma.TransactionClient,
  ctx: AuditMutationContext,
  categoryId: string,
  input: UpdateCategoryRequest,
): Promise<CategoryDTO> {
  const current = await tx.productCategory.findUnique({
    where: { id: categoryId },
    include: { _count: { select: { products: true } } },
  });
  if (!current) throw new DomainError('NOT_FOUND', 404);

  if (input.parentId !== undefined && input.parentId !== null) {
    if (input.parentId === categoryId) {
      throw new DomainError('CATEGORY_PARENT_INVALID', 400, { reason: 'self-reference' });
    }
    const parent = await tx.productCategory.findUnique({ where: { id: input.parentId } });
    if (!parent) throw new DomainError('CATEGORY_PARENT_INVALID', 400);
  }

  const updated = await tx.productCategory.update({
    where: { id: categoryId },
    data: {
      ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.parentId !== undefined ? { parentId: input.parentId } : {}),
    },
    include: { _count: { select: { products: true } } },
  });

  const before = toDTO(current, current._count.products);
  const after = toDTO(updated, updated._count.products);

  await recordMutation(ctx, {
    entity: 'product_category',
    entityId: categoryId,
    action: 'UPDATE',
    before,
    after,
  });
  return after;
}

export async function deleteCategory(
  tx: Prisma.TransactionClient,
  ctx: AuditMutationContext,
  categoryId: string,
): Promise<void> {
  const current = await tx.productCategory.findUnique({
    where: { id: categoryId },
    include: { _count: { select: { products: true, children: true } } },
  });
  if (!current) throw new DomainError('NOT_FOUND', 404);

  if (current._count.products > 0) {
    throw new DomainError('CATEGORY_HAS_PRODUCTS', 409, {
      productsCount: current._count.products,
    });
  }
  if (current._count.children > 0) {
    throw new DomainError('CATEGORY_HAS_CHILDREN', 409, {
      childrenCount: current._count.children,
    });
  }

  await tx.productCategory.delete({ where: { id: categoryId } });
  await recordMutation(ctx, {
    entity: 'product_category',
    entityId: categoryId,
    action: 'DELETE',
    before: toDTO(current, 0),
  });
}

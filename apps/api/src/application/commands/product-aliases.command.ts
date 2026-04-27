/**
 * Aliases para productos: añadir / eliminar.
 * Resuelve inconsistencias del Excel ("Paprika" ↔ "Paprika Dulce/Ahumada").
 */
import { Prisma, type Prisma as PrismaTypes } from '@brasa/db';
import { DomainError } from '../../infrastructure/http/plugins/error-handler.plugin.js';
import { recordMutation, type AuditMutationContext } from '../shared/audit-helper.js';

export async function addProductAlias(
  tx: PrismaTypes.TransactionClient,
  ctx: AuditMutationContext,
  productId: string,
  alias: string,
): Promise<{ id: string; alias: string; productId: string; createdAt: string }> {
  const trimmed = alias.trim();
  if (!trimmed) throw new DomainError('VALIDATION_FAILED', 400);

  const product = await tx.product.findUnique({ where: { id: productId } });
  if (!product) throw new DomainError('NOT_FOUND', 404);

  try {
    const created = await tx.productAlias.create({
      data: { productId, alias: trimmed, createdById: ctx.actorId },
    });

    await recordMutation(ctx, {
      entity: 'product_alias',
      entityId: created.id,
      action: 'INSERT',
      after: { productId, alias: trimmed },
    });

    return {
      id: created.id,
      alias: created.alias,
      productId: created.productId,
      createdAt: created.createdAt.toISOString(),
    };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new DomainError('PRODUCT_ALIAS_TAKEN', 409, { alias: trimmed });
    }
    throw err;
  }
}

export async function removeProductAlias(
  tx: PrismaTypes.TransactionClient,
  ctx: AuditMutationContext,
  productId: string,
  aliasId: string,
): Promise<void> {
  const existing = await tx.productAlias.findUnique({ where: { id: aliasId } });
  if (!existing || existing.productId !== productId) {
    throw new DomainError('NOT_FOUND', 404);
  }
  await tx.productAlias.delete({ where: { id: aliasId } });
  await recordMutation(ctx, {
    entity: 'product_alias',
    entityId: aliasId,
    action: 'DELETE',
    before: { productId: existing.productId, alias: existing.alias },
  });
}

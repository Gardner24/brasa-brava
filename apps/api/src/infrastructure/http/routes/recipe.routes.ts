/**
 * CRUD recetas + cálculo de costo + scaling.
 *   GET    /recipes                  — listado paginado
 *   GET    /recipes/:id              — detalle con costo recursivo
 *   POST   /recipes                  — crear
 *   PATCH  /recipes/:id              — editar metadata
 *   DELETE /recipes/:id              — archivar
 *   PUT    /recipes/:id/lines        — reemplazo atómico de líneas
 *   GET    /recipes/:id/scale?guestCount=N — escalar ingredientes
 */
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import {
  ListRecipesQuery,
  CreateRecipeRequest,
  UpdateRecipeRequest,
  ReplaceRecipeLinesRequest,
  ScaleRecipeRequest,
} from '@brasa/shared-types';
import { listRecipes } from '../../../application/queries/list-recipes.query.js';
import { getRecipeDetail } from '../../../application/queries/get-recipe-detail.query.js';
import { scaleRecipe } from '../../../application/queries/scale-recipe.query.js';
import { createRecipe } from '../../../application/commands/create-recipe.command.js';
import { updateRecipe } from '../../../application/commands/update-recipe.command.js';
import { archiveRecipe } from '../../../application/commands/archive-recipe.command.js';
import { replaceRecipeLines } from '../../../application/commands/replace-recipe-lines.command.js';
import { DomainError } from '../plugins/error-handler.plugin.js';
import type { AuditMutationContext } from '../../../application/shared/audit-helper.js';

const ParamsId = z.object({ id: z.string().uuid() });
const ArchiveQuery = z.object({
  expectedVersion: z.coerce.number().int().nonnegative(),
  force: z.coerce.boolean().optional().default(false),
});

export const recipeRoutes: FastifyPluginAsync = async (app) => {
  const buildCtx = (req: import('fastify').FastifyRequest): AuditMutationContext => {
    const auth = req.auth;
    if (!auth) throw new DomainError('UNAUTHORIZED', 401);
    return {
      app,
      tenantId: auth.tenantId,
      actorId: auth.userId,
      actorEmail: '(via-token)',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      requestId: req.id,
    };
  };

  app.get('/', {
    preHandler: [app.requirePermission('recipe.read')],
    schema: { tags: ['recipes'], security: [{ bearerAuth: [] }] },
  }, async (req) => {
    const query = ListRecipesQuery.parse(req.query);
    return req.db.tx((tx) => listRecipes(tx, query));
  });

  app.get('/:id', {
    preHandler: [app.requirePermission('recipe.read')],
    schema: { tags: ['recipes'], security: [{ bearerAuth: [] }] },
  }, async (req) => {
    const { id } = ParamsId.parse(req.params);
    return req.db.tx((tx) => getRecipeDetail(tx, id));
  });

  app.post('/', {
    preHandler: [app.requirePermission('recipe.write')],
    schema: { tags: ['recipes'], security: [{ bearerAuth: [] }] },
  }, async (req, reply) => {
    const input = CreateRecipeRequest.parse(req.body);
    const ctx = buildCtx(req);
    const recipe = await req.db.tx((tx) => createRecipe(tx, ctx, input));
    return reply.status(201).send(recipe);
  });

  app.patch('/:id', {
    preHandler: [app.requirePermission('recipe.write')],
    schema: { tags: ['recipes'], security: [{ bearerAuth: [] }] },
  }, async (req) => {
    const { id } = ParamsId.parse(req.params);
    const input = UpdateRecipeRequest.parse(req.body);
    const ctx = buildCtx(req);
    return req.db.tx((tx) => updateRecipe(tx, ctx, id, input));
  });

  app.delete('/:id', {
    preHandler: [app.requirePermission('recipe.write')],
    schema: { tags: ['recipes'], security: [{ bearerAuth: [] }] },
  }, async (req) => {
    const { id } = ParamsId.parse(req.params);
    const { expectedVersion, force } = ArchiveQuery.parse(req.query);
    const ctx = buildCtx(req);
    return req.db.tx((tx) => archiveRecipe(tx, ctx, id, { expectedVersion, force }));
  });

  app.put('/:id/lines', {
    preHandler: [app.requirePermission('recipe.write')],
    schema: { tags: ['recipes'], security: [{ bearerAuth: [] }] },
  }, async (req) => {
    const { id } = ParamsId.parse(req.params);
    const input = ReplaceRecipeLinesRequest.parse(req.body);
    const ctx = buildCtx(req);
    return req.db.tx((tx) => replaceRecipeLines(tx, ctx, id, input));
  });

  app.get('/:id/scale', {
    preHandler: [app.requirePermission('recipe.read')],
    schema: { tags: ['recipes'], security: [{ bearerAuth: [] }] },
  }, async (req) => {
    const { id } = ParamsId.parse(req.params);
    const input = ScaleRecipeRequest.parse(req.query);
    return req.db.tx((tx) => scaleRecipe(tx, id, input));
  });
};

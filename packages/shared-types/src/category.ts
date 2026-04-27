import { z } from 'zod';
import { UUID } from './common.js';

export const CategoryDTO = z.object({
  id: UUID,
  code: z.string().min(1).max(32),
  displayName: z.string().min(1).max(80),
  description: z.string().nullable(),
  parentId: UUID.nullable(),
  productsCount: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
});
export type CategoryDTO = z.infer<typeof CategoryDTO>;

export const CreateCategoryRequest = z.object({
  code: z.string().min(1).max(32).regex(/^[A-Z0-9_]+$/, 'Code must be UPPERCASE letters, digits or underscore'),
  displayName: z.string().min(1).max(80),
  description: z.string().max(500).optional(),
  parentId: UUID.optional(),
});
export type CreateCategoryRequest = z.infer<typeof CreateCategoryRequest>;

export const UpdateCategoryRequest = z.object({
  displayName: z.string().min(1).max(80).optional(),
  description: z.string().max(500).nullable().optional(),
  parentId: UUID.nullable().optional(),
});
export type UpdateCategoryRequest = z.infer<typeof UpdateCategoryRequest>;

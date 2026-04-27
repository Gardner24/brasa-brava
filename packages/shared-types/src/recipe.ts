import { z } from 'zod';
import { Bilingual, UUID } from './common.js';

export const RecipeYieldUnit = z.enum(['porcion', 'g', 'ml', 'unit']);
export type RecipeYieldUnit = z.infer<typeof RecipeYieldUnit>;

export const RecipeLineUnit = z.enum(['g', 'ml', 'unit', 'porcion']);
export type RecipeLineUnit = z.infer<typeof RecipeLineUnit>;

// ===== Línea de receta =====

export const RecipeLineDTO = z.object({
  id: UUID,
  productId: UUID.nullable(),
  subRecipeId: UUID.nullable(),
  // Display info embebida (evita N+1 en frontend)
  productName: Bilingual.nullable(),
  productSku: z.string().nullable(),
  productUnitCost: z.number().nullable(),
  subRecipeName: Bilingual.nullable(),
  subRecipeCode: z.string().nullable(),
  qtyPerPortion: z.number(),
  unit: RecipeLineUnit,
  notes: z.string().nullable(),
  position: z.number().int(),
  // Costo de esta línea por porción (qty * unit_cost)
  lineCostPerPortion: z.number(),
});
export type RecipeLineDTO = z.infer<typeof RecipeLineDTO>;

// Para input de líneas (creación/replace)
export const RecipeLineInput = z
  .object({
    productId: UUID.nullable().optional(),
    subRecipeId: UUID.nullable().optional(),
    qtyPerPortion: z.number().positive(),
    unit: RecipeLineUnit,
    notes: z.string().max(500).optional(),
    position: z.number().int().nonnegative(),
  })
  .refine((v) => Boolean(v.productId) !== Boolean(v.subRecipeId), {
    message: 'Each line must reference exactly one of productId or subRecipeId',
    path: ['productId'],
  });
export type RecipeLineInput = z.infer<typeof RecipeLineInput>;

// ===== Receta =====

export const RecipeDTO = z.object({
  id: UUID,
  code: z.string().min(1).max(40),
  name: Bilingual,
  yieldQty: z.number().positive(),
  yieldUnit: RecipeYieldUnit,
  cookingTemp: z.string().nullable(),
  cookingTime: z.string().nullable(),
  isActive: z.boolean(),
  version: z.number().int().nonnegative(),
  linesCount: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type RecipeDTO = z.infer<typeof RecipeDTO>;

export const RecipeDetailDTO = RecipeDTO.extend({
  instructions: z.string().nullable(),
  lines: z.array(RecipeLineDTO),
  // Costo total por porción (suma de lineCostPerPortion + recursión a sub-recetas)
  costPerPortion: z.number(),
  // Costo total para N porciones (default = yieldQty)
  costForYield: z.number(),
  // ¿Algún producto referenciado tiene costo faltante?
  hasIncompleteCost: z.boolean(),
  incompleteProducts: z.array(z.object({ productId: UUID, sku: z.string() })),
});
export type RecipeDetailDTO = z.infer<typeof RecipeDetailDTO>;

// ===== Requests =====

export const CreateRecipeRequest = z.object({
  code: z.string().min(1).max(40).regex(/^[A-Z0-9_-]+$/),
  name: Bilingual,
  yieldQty: z.number().positive().default(1),
  yieldUnit: RecipeYieldUnit.default('porcion'),
  instructions: z.string().max(5000).optional(),
  cookingTemp: z.string().max(40).optional(),
  cookingTime: z.string().max(40).optional(),
});
export type CreateRecipeRequest = z.infer<typeof CreateRecipeRequest>;

export const UpdateRecipeRequest = z.object({
  name: Bilingual.optional(),
  yieldQty: z.number().positive().optional(),
  yieldUnit: RecipeYieldUnit.optional(),
  instructions: z.string().max(5000).nullable().optional(),
  cookingTemp: z.string().max(40).nullable().optional(),
  cookingTime: z.string().max(40).nullable().optional(),
  isActive: z.boolean().optional(),
  expectedVersion: z.number().int().nonnegative(),
});
export type UpdateRecipeRequest = z.infer<typeof UpdateRecipeRequest>;

export const ReplaceRecipeLinesRequest = z.object({
  expectedVersion: z.number().int().nonnegative(),
  lines: z.array(RecipeLineInput).max(200),
});
export type ReplaceRecipeLinesRequest = z.infer<typeof ReplaceRecipeLinesRequest>;

export const ListRecipesQuery = z.object({
  search: z.string().optional(),
  menuCode: z.string().optional(),
  isActive: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .transform((v) => (typeof v === 'boolean' ? v : v === 'true'))
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});
export type ListRecipesQuery = z.infer<typeof ListRecipesQuery>;

// ===== Scaling =====

export const ScaleRecipeRequest = z.object({
  guestCount: z.coerce.number().int().min(1).max(10000),
});
export type ScaleRecipeRequest = z.infer<typeof ScaleRecipeRequest>;

export const ScaledRecipeDTO = z.object({
  recipeId: UUID,
  guestCount: z.number().int().positive(),
  costPerPortion: z.number(),
  totalCost: z.number(),
  ingredients: z.array(
    z.object({
      productId: UUID,
      sku: z.string(),
      name: Bilingual,
      cumulativeQty: z.number(),
      unit: z.string(),
      unitCost: z.number(),
      lineCost: z.number(),
    }),
  ),
});
export type ScaledRecipeDTO = z.infer<typeof ScaledRecipeDTO>;

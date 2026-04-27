import { z } from 'zod';
import { UUID } from './common.js';

export const WarehouseDTO = z.object({
  id: UUID,
  code: z.string().min(1).max(20),
  displayName: z.string().min(1).max(80),
  isActive: z.boolean(),
  // Cached aggregates para vista de cards
  itemsCount: z.number().int().nonnegative(),
  totalValueCRC: z.number(),
  openAlertsCount: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
});
export type WarehouseDTO = z.infer<typeof WarehouseDTO>;

export const CreateWarehouseRequest = z.object({
  code: z.string().min(1).max(20).regex(/^[A-Z0-9_-]+$/, 'Code must be UPPERCASE letters, digits, _ or -'),
  displayName: z.string().min(1).max(80),
});
export type CreateWarehouseRequest = z.infer<typeof CreateWarehouseRequest>;

export const UpdateWarehouseRequest = z.object({
  displayName: z.string().min(1).max(80).optional(),
  isActive: z.boolean().optional(),
});
export type UpdateWarehouseRequest = z.infer<typeof UpdateWarehouseRequest>;

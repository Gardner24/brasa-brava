import { z } from 'zod';

export const UUID = z.string().uuid();
export type UUID = z.infer<typeof UUID>;

export const Locale = z.enum(['es', 'en']);
export type Locale = z.infer<typeof Locale>;

export const Bilingual = z.object({
  es: z.string().min(1),
  en: z.string().min(1),
});
export type Bilingual = z.infer<typeof Bilingual>;

export const Pagination = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});
export type Pagination = z.infer<typeof Pagination>;

export const Paginated = <T extends z.ZodTypeAny>(item: T) =>
  z.object({
    data: z.array(item),
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1),
    total: z.number().int().min(0),
  });

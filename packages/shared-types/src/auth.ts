import { z } from 'zod';

export const LoginRequest = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  totp: z.string().regex(/^\d{6}$/).optional(),
});
export type LoginRequest = z.infer<typeof LoginRequest>;

export const LoginResponse = z.object({
  accessToken: z.string(),
  expiresIn: z.number().int().positive(),
  user: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    fullName: z.string(),
    locale: z.enum(['es', 'en']),
    roles: z.array(z.string()),
    permissions: z.array(z.string()),
  }),
});
export type LoginResponse = z.infer<typeof LoginResponse>;

export const RefreshResponse = z.object({
  accessToken: z.string(),
  expiresIn: z.number().int().positive(),
});
export type RefreshResponse = z.infer<typeof RefreshResponse>;

/** JWT payload claims. iat/exp son opcionales: fast-jwt los inyecta cuando
 * se pasa `expiresIn` al firmar, pero si por alguna razón faltan no debe
 * romper el verify (la firma ya garantiza autenticidad y la verificación
 * de expiración la hace fast-jwt antes de que esto se evalúe).
 */
export const AccessTokenClaims = z.object({
  sub: z.string().uuid(), // user id
  tid: z.string().uuid(), // tenant id
  rls: z.array(z.string()), // role codes
  prm: z.array(z.string()), // permissions
  iat: z.number().optional(),
  exp: z.number().optional(),
});
export type AccessTokenClaims = z.infer<typeof AccessTokenClaims>;

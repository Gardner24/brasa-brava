/**
 * Validación de variables de entorno con Zod.
 * Falla al boot si faltan o son inválidas — fail fast.
 */
import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_HOST: z.string().default('0.0.0.0'),
  API_PORT: z.coerce.number().int().positive().default(4000),
  API_PUBLIC_URL: z.string().url().default('http://localhost:4000'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url().optional(),

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be ≥32 chars'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be ≥32 chars'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('7d'),

  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_FROM: z.string().optional(),

  CORS_ORIGINS: z
    .string()
    .default('http://localhost:5173')
    .transform((s) => s.split(',').map((o) => o.trim())),

  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  RATE_LIMIT_WINDOW: z.string().default('1 minute'),
});

export type Env = z.infer<typeof EnvSchema>;

export function loadEnv(): Env {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error('❌ Configuración inválida:');
    for (const issue of parsed.error.issues) {
      console.error(`   ${issue.path.join('.')}: ${issue.message}`);
    }
    process.exit(1);
  }
  return parsed.data;
}

/**
 * Composición del servidor: registra plugins en orden, ensambla rutas.
 * Devuelve la instancia de Fastify lista para `listen()`.
 */
import Fastify, { type FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import sensible from '@fastify/sensible';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { ulid } from 'ulid';
import type { Env } from './config/env.js';
import { authPlugin } from './infrastructure/http/plugins/auth.plugin.js';
import { tenantContextPlugin } from './infrastructure/http/plugins/tenant-context.plugin.js';
import { errorHandlerPlugin } from './infrastructure/http/plugins/error-handler.plugin.js';
import { auditLogPlugin } from './infrastructure/http/plugins/audit-log.plugin.js';
import { healthRoutes } from './infrastructure/http/routes/health.routes.js';
import { authRoutes } from './infrastructure/http/routes/auth.routes.js';
import { productRoutes } from './infrastructure/http/routes/product.routes.js';
import { recipeRoutes } from './infrastructure/http/routes/recipe.routes.js';
import { categoryRoutes } from './infrastructure/http/routes/category.routes.js';
import { auditLogRoutes } from './infrastructure/http/routes/audit-log.routes.js';

export async function buildServer(env: Env): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      transport:
        env.NODE_ENV === 'development'
          ? { target: 'pino-pretty', options: { colorize: true, singleLine: false } }
          : undefined,
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'res.headers["set-cookie"]',
          '*.password',
          '*.passwordHash',
          '*.token',
          '*.refreshToken',
        ],
        censor: '[REDACTED]',
      },
    },
    genReqId: () => ulid(),
    requestIdHeader: 'x-request-id',
    requestIdLogLabel: 'requestId',
    trustProxy: env.NODE_ENV === 'production',
    bodyLimit: 1024 * 1024, // 1MB
  });

  // ===== Decorate config =====
  app.decorate('env', env);

  // ===== Security plugins =====
  await app.register(cookie, { hook: 'onRequest' });
  await app.register(helmet, {
    contentSecurityPolicy: env.NODE_ENV === 'production' ? undefined : false,
  });
  await app.register(cors, {
    origin: env.CORS_ORIGINS,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });
  await app.register(sensible);
  await app.register(rateLimit, {
    max: env.RATE_LIMIT_MAX,
    timeWindow: env.RATE_LIMIT_WINDOW,
  });

  // ===== OpenAPI =====
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'Brasa Brava API',
        description: 'Sistema de Inventario y Auditoría',
        version: '0.1.0',
      },
      servers: [{ url: env.API_PUBLIC_URL }],
      components: {
        securitySchemes: {
          bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        },
      },
    },
  });
  await app.register(swaggerUi, { routePrefix: '/docs' });

  // ===== Domain plugins =====
  await app.register(errorHandlerPlugin);
  await app.register(authPlugin);
  await app.register(tenantContextPlugin);
  await app.register(auditLogPlugin);

  // ===== Routes =====
  await app.register(healthRoutes, { prefix: '/health' });
  await app.register(authRoutes, { prefix: '/auth' });
  await app.register(productRoutes, { prefix: '/products' });
  await app.register(recipeRoutes, { prefix: '/recipes' });
  await app.register(categoryRoutes, { prefix: '/categories' });
  await app.register(auditLogRoutes, { prefix: '/audit-log' });

  await app.ready();
  return app;
}

declare module 'fastify' {
  interface FastifyInstance {
    env: Env;
  }
}

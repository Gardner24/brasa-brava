/**
 * Autenticación JWT.
 *  - Verifica access token (HS256) vía @fastify/jwt
 *  - Decora request con `auth: { userId, tenantId, roles, permissions }`
 *  - Expone `requireAuth()` y `requirePermission(perm)` como helpers
 */
import fp from 'fastify-plugin';
import jwt from '@fastify/jwt';
import { AccessTokenClaims } from '@brasa/shared-types';
import { DomainError } from './error-handler.plugin.js';

export interface AuthContext {
  userId: string;
  tenantId: string;
  roles: string[];
  permissions: string[];
}

export const authPlugin = fp(async (app) => {
  await app.register(jwt, {
    secret: app.env.JWT_ACCESS_SECRET,
    sign: { expiresIn: app.env.JWT_ACCESS_TTL },
  });

  app.decorateRequest('auth', null);

  app.addHook('onRequest', async (req) => {
    if (isPublicRoute(req.routeOptions.url)) return;
    try {
      await req.jwtVerify();
    } catch {
      throw new DomainError('UNAUTHORIZED', 401);
    }
    const claims = AccessTokenClaims.parse(req.user);
    req.auth = {
      userId: claims.sub,
      tenantId: claims.tid,
      roles: claims.rls,
      permissions: claims.prm,
    };
  });

  app.decorate('requirePermission', (perm: string) => {
    return async (req: import('fastify').FastifyRequest) => {
      const auth = req.auth;
      if (!auth) throw new DomainError('UNAUTHORIZED', 401);
      const allowed = auth.permissions.includes('*') || auth.permissions.includes(perm);
      if (!allowed) {
        throw new DomainError('FORBIDDEN', 403, { required: perm });
      }
    };
  });
});

const PUBLIC_ROUTE_PREFIXES = ['/health', '/auth/login', '/auth/refresh', '/docs'];

function isPublicRoute(url: string | undefined): boolean {
  if (!url) return false;
  return PUBLIC_ROUTE_PREFIXES.some((p) => url.startsWith(p));
}

declare module 'fastify' {
  interface FastifyRequest {
    auth: AuthContext | null;
  }
  interface FastifyInstance {
    requirePermission: (perm: string) => (req: import('fastify').FastifyRequest) => Promise<void>;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: string; tid: string; rls: string[]; prm: string[] };
  }
}

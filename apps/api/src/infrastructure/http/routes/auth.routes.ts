/**
 * Endpoints de autenticación: login, refresh, logout, me.
 *  - login: emite access (JWT 15m) + refresh (cookie httpOnly, 7d)
 *  - refresh: rota refresh token; detecta reuse
 *  - logout: revoca refresh actual
 *  - me: devuelve perfil + permisos del usuario autenticado
 */
import type { FastifyPluginAsync } from 'fastify';
import { LoginRequest, LoginResponse, type AccessTokenClaims } from '@brasa/shared-types';
import { hashPassword, verifyPassword } from '../../auth/password.js';
import { issueRefresh, rotateRefresh, revokeAllForUser } from '../../auth/refresh-tokens.js';
import { DomainError } from '../plugins/error-handler.plugin.js';

const REFRESH_COOKIE = 'rt';
const REFRESH_COOKIE_OPTS = {
  httpOnly: true,
  secure: true,
  sameSite: 'strict' as const,
  path: '/auth',
};

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post('/login', {
    schema: {
      tags: ['auth'],
      summary: 'Login con email + password (+ TOTP opcional)',
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 1 },
          totp: { type: 'string', pattern: '^\\d{6}$' },
        },
        additionalProperties: false,
      },
      // No declaramos response schema: el serializer fast-json-stringify de
      // Fastify strippea campos no listados. Zod valida la salida dentro del
      // handler vía LoginResponse.parse(...).
    },
  }, async (req, reply) => {
    const body = LoginRequest.parse(req.body);

    const user = await app.rawPrisma.user.findUnique({
      where: { email: body.email.toLowerCase() },
      include: { userRoles: { include: { role: true } } },
    });
    if (!user || !user.isActive) {
      await app.audit.record({
        actorEmail: body.email,
        entity: 'user',
        entityId: user?.id ?? '00000000-0000-0000-0000-000000000000',
        action: 'LOGIN_FAILED',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        requestId: req.id,
      });
      throw new DomainError('INVALID_CREDENTIALS', 401);
    }

    const ok = await verifyPassword(user.passwordHash, body.password);
    if (!ok) {
      await app.audit.record({
        actorEmail: body.email,
        entity: 'user',
        entityId: user.id,
        action: 'LOGIN_FAILED',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        requestId: req.id,
      });
      throw new DomainError('INVALID_CREDENTIALS', 401);
    }

    if (user.mfaEnabled) {
      if (!body.totp) throw new DomainError('MFA_REQUIRED', 401);
      // TODO: validar TOTP con otplib usando user.mfaSecret
      // Stub para no introducir dependencia hasta que se active la feature.
    }

    const roles = user.userRoles.map((ur) => ur.role.code);
    const permissions = Array.from(
      new Set(user.userRoles.flatMap((ur) => (ur.role.permissions as string[]) ?? [])),
    );

    const claims: Omit<AccessTokenClaims, 'iat' | 'exp'> = {
      sub: user.id,
      tid: user.tenantId,
      rls: roles,
      prm: permissions,
    };
    // Pasamos expiresIn explícito: en @fastify/jwt v8 la opción del registro
    // no siempre se propaga si el payload es objeto.
    const accessToken = await reply.jwtSign(claims, { expiresIn: app.env.JWT_ACCESS_TTL });

    const refresh = await issueRefresh({
      userId: user.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    await app.rawPrisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
    await app.audit.record({
      tenantId: user.tenantId,
      actorId: user.id,
      actorEmail: user.email,
      entity: 'user',
      entityId: user.id,
      action: 'LOGIN',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      requestId: req.id,
    });

    reply.setCookie(REFRESH_COOKIE, refresh.rawToken, {
      ...REFRESH_COOKIE_OPTS,
      expires: refresh.expiresAt,
    });

    const response = LoginResponse.parse({
      accessToken,
      expiresIn: parseTtlSeconds(app.env.JWT_ACCESS_TTL),
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        locale: user.locale as 'es' | 'en',
        roles,
        permissions,
      },
    });
    return response;
  });

  app.post('/refresh', { schema: { tags: ['auth'] } }, async (req, reply) => {
    const raw = req.cookies[REFRESH_COOKIE];
    if (!raw) throw new DomainError('UNAUTHORIZED', 401);

    const result = await rotateRefresh(raw, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
    if ('reuseDetected' in result) {
      reply.clearCookie(REFRESH_COOKIE, REFRESH_COOKIE_OPTS);
      throw new DomainError('TOKEN_REUSED', 401);
    }

    const user = await app.rawPrisma.user.findUniqueOrThrow({
      where: { id: result.userId },
      include: { userRoles: { include: { role: true } } },
    });
    const roles = user.userRoles.map((ur) => ur.role.code);
    const permissions = Array.from(
      new Set(user.userRoles.flatMap((ur) => (ur.role.permissions as string[]) ?? [])),
    );

    const accessToken = await reply.jwtSign(
      {
        sub: user.id,
        tid: user.tenantId,
        rls: roles,
        prm: permissions,
      },
      { expiresIn: app.env.JWT_ACCESS_TTL },
    );

    reply.setCookie(REFRESH_COOKIE, result.issued.rawToken, {
      ...REFRESH_COOKIE_OPTS,
      expires: result.issued.expiresAt,
    });

    return { accessToken, expiresIn: parseTtlSeconds(app.env.JWT_ACCESS_TTL) };
  });

  app.post('/logout', { schema: { tags: ['auth'], security: [{ bearerAuth: [] }] } }, async (req, reply) => {
    if (req.auth) {
      await revokeAllForUser(req.auth.userId);
      await app.audit.record({
        tenantId: req.auth.tenantId,
        actorId: req.auth.userId,
        actorEmail: '(via-token)',
        entity: 'user',
        entityId: req.auth.userId,
        action: 'LOGOUT',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        requestId: req.id,
      });
    }
    reply.clearCookie(REFRESH_COOKIE, REFRESH_COOKIE_OPTS);
    return { ok: true };
  });

  app.get('/me', { schema: { tags: ['auth'], security: [{ bearerAuth: [] }] } }, async (req) => {
    if (!req.auth) throw new DomainError('UNAUTHORIZED', 401);
    return req.db.tx(async (tx) => {
      const me = await tx.user.findUniqueOrThrow({
        where: { id: req.auth!.userId },
        select: { id: true, email: true, fullName: true, locale: true, mfaEnabled: true },
      });
      return { ...me, roles: req.auth!.roles, permissions: req.auth!.permissions };
    });
  });
};

function parseTtlSeconds(ttl: string): number {
  const m = /^(\d+)(s|m|h|d)$/.exec(ttl);
  if (!m) return 900;
  const n = Number(m[1]);
  switch (m[2]) {
    case 's': return n;
    case 'm': return n * 60;
    case 'h': return n * 3600;
    case 'd': return n * 86400;
    default:  return 900;
  }
}

// Sentinel para evitar warning de variable no usada del tooling
void hashPassword;

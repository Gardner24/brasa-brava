/**
 * Refresh tokens con rotación obligatoria.
 *
 * Reglas:
 *  - Un refresh válido se canjea por (access nuevo + refresh nuevo); el viejo se revoca.
 *  - Reusar un refresh ya revocado dispara revocación de TODOS los refresh del usuario
 *    (asunción de compromiso) y obliga relogin.
 *  - Tokens se almacenan hasheados (SHA-256) — nunca en plano.
 */
import crypto from 'node:crypto';
import { prisma } from '@brasa/db';

export interface IssuedRefresh {
  rawToken: string;
  id: string;
  expiresAt: Date;
}

const REFRESH_TTL_DAYS = 7;

export function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

export async function issueRefresh(opts: {
  userId: string;
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
  replacesId?: string | undefined;
}): Promise<IssuedRefresh> {
  const raw = crypto.randomBytes(48).toString('base64url');
  const tokenHash = hashToken(raw);
  const expiresAt = new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);

  const created = await prisma.authRefreshToken.create({
    data: {
      userId: opts.userId,
      tokenHash,
      expiresAt,
      ipAddress: opts.ipAddress ?? null,
      userAgent: opts.userAgent ?? null,
    },
  });

  if (opts.replacesId) {
    await prisma.authRefreshToken.update({
      where: { id: opts.replacesId },
      data: { revokedAt: new Date(), replacedById: created.id },
    });
  }

  return { rawToken: raw, id: created.id, expiresAt };
}

export async function rotateRefresh(rawToken: string, opts: {
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
}): Promise<{ userId: string; issued: IssuedRefresh } | { reuseDetected: true; userId: string }> {
  const tokenHash = hashToken(rawToken);
  const existing = await prisma.authRefreshToken.findUnique({ where: { tokenHash } });

  if (!existing) {
    return { reuseDetected: true, userId: '' };
  }

  // Reuse attack: token ya revocado
  if (existing.revokedAt) {
    await prisma.authRefreshToken.updateMany({
      where: { userId: existing.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { reuseDetected: true, userId: existing.userId };
  }

  if (existing.expiresAt < new Date()) {
    return { reuseDetected: true, userId: existing.userId };
  }

  const issued = await issueRefresh({
    userId: existing.userId,
    ipAddress: opts.ipAddress,
    userAgent: opts.userAgent,
    replacesId: existing.id,
  });

  return { userId: existing.userId, issued };
}

export async function revokeAllForUser(userId: string): Promise<void> {
  await prisma.authRefreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

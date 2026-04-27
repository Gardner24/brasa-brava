/**
 * Wrapper de Argon2id. Centraliza parámetros para que la rotación
 * (subir cost) afecte a toda la app.
 */
import argon2 from 'argon2';

const ARGON2_OPTS = {
  type: argon2.argon2id,
  memoryCost: 19_456, // 19 MiB — recomendación OWASP 2023
  timeCost: 2,
  parallelism: 1,
} as const;

export async function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, ARGON2_OPTS);
}

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
}

export async function needsRehash(hash: string): Promise<boolean> {
  return argon2.needsRehash(hash, ARGON2_OPTS);
}

/**
 * Cliente HTTP minimal — fetch wrapper con tipos.
 * En Fase 2 lo reemplazaremos por un cliente generado desde OpenAPI.
 */
import type { ApiErrorBody } from '@brasa/shared-types';

const BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '/api';

let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export class ApiError extends Error {
  constructor(public readonly body: ApiErrorBody, public readonly status: number) {
    super(body.code);
    this.name = 'ApiError';
  }
}

export async function api<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers,
    credentials: 'include',
  });

  if (!res.ok) {
    let body: ApiErrorBody;
    try {
      body = (await res.json()) as ApiErrorBody;
    } catch {
      body = { code: 'INTERNAL' };
    }
    throw new ApiError(body, res.status);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

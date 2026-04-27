/**
 * AuthContext: estado de autenticación de la app.
 *
 * - El access token vive **en memoria** (no localStorage) por seguridad.
 * - El refresh token vive en cookie httpOnly setteada por el backend.
 * - Al boot intentamos /auth/refresh: si succeed, usuario ya logueado.
 * - Logout limpia memoria + revoca refresh en backend.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { setAccessToken, api } from './api.ts';

interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  locale: 'es' | 'en';
  roles: string[];
  permissions: string[];
}

interface AuthState {
  status: 'idle' | 'authenticating' | 'authenticated' | 'anonymous';
  user: SessionUser | null;
  login: (email: string, password: string, totp?: string) => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (perm: string) => boolean;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthState['status']>('idle');
  const [user, setUser] = useState<SessionUser | null>(null);

  // Boot: intentar refresh para resucitar sesión existente
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const refreshed = await api<{ accessToken: string; expiresIn: number }>('/auth/refresh', {
          method: 'POST',
        });
        setAccessToken(refreshed.accessToken);
        const me = await api<SessionUser>('/auth/me');
        if (cancelled) return;
        setUser(me);
        setStatus('authenticated');
        scheduleRefresh(refreshed.expiresIn);
      } catch {
        if (cancelled) return;
        setStatus('anonymous');
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scheduleRefresh = useCallback((expiresInSec: number) => {
    // Refresh ~60s antes del expiry
    const ms = Math.max(5_000, (expiresInSec - 60) * 1000);
    window.setTimeout(async () => {
      try {
        const r = await api<{ accessToken: string; expiresIn: number }>('/auth/refresh', {
          method: 'POST',
        });
        setAccessToken(r.accessToken);
        scheduleRefresh(r.expiresIn);
      } catch {
        setAccessToken(null);
        setUser(null);
        setStatus('anonymous');
      }
    }, ms);
  }, []);

  const login = useCallback(
    async (email: string, password: string, totp?: string) => {
      setStatus('authenticating');
      const body: Record<string, string> = { email, password };
      if (totp) body.totp = totp;
      const res = await api<{
        accessToken: string;
        expiresIn: number;
        user: SessionUser;
      }>('/auth/login', { method: 'POST', body: JSON.stringify(body) });
      setAccessToken(res.accessToken);
      setUser(res.user);
      setStatus('authenticated');
      scheduleRefresh(res.expiresIn);
    },
    [scheduleRefresh],
  );

  const logout = useCallback(async () => {
    try {
      await api('/auth/logout', { method: 'POST' });
    } catch {
      /* even on error we clean up locally */
    }
    setAccessToken(null);
    setUser(null);
    setStatus('anonymous');
  }, []);

  const hasPermission = useCallback(
    (perm: string) => {
      if (!user) return false;
      return user.permissions.includes('*') || user.permissions.includes(perm);
    },
    [user],
  );

  const value = useMemo<AuthState>(
    () => ({ status, user, login, logout, hasPermission }),
    [status, user, login, logout, hasPermission],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}

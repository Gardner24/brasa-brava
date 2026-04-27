import { useRef, useState, type FormEvent } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button.tsx';
import { Input } from '@/components/ui/input.tsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.tsx';
import { Spinner } from '@/components/ui/spinner.tsx';
import { LanguageSwitcher } from '@/components/ui/language-switcher.tsx';
import { HeroIntro } from '@/components/branding/HeroIntro.tsx';
import { useAuth } from '@/lib/auth-context.tsx';
import { ApiError } from '@/lib/api.ts';

export function LoginPage() {
  const { t } = useTranslation();
  const { status, login } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const formRef = useRef<HTMLDivElement>(null);

  const [email, setEmail] = useState('admin@brasabrava.local');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (status === 'authenticated') {
    const redirectTo = (loc.state as { from?: string } | null)?.from ?? '/catalog';
    return <Navigate to={redirectTo} replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      nav((loc.state as { from?: string } | null)?.from ?? '/catalog', { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(t(`errors.${err.body.code}`, t('errors.INTERNAL')));
      } else {
        setError(t('errors.INTERNAL'));
      }
    } finally {
      setLoading(false);
    }
  }

  function scrollToForm() {
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div className="bg-background">
      <div className="absolute right-4 top-4 z-20">
        <LanguageSwitcher />
      </div>

      <HeroIntro onEnterClick={scrollToForm} />

      <section
        ref={formRef}
        className="flex min-h-screen items-center justify-center bg-cream px-4 py-16"
      >
        <Card className="w-full max-w-md border-border/40 shadow-sm">
          <CardHeader className="items-center text-center">
            <CardTitle className="font-display text-2xl">
              {t('login.welcomeBack', 'Bienvenido de vuelta')}
            </CardTitle>
            <CardDescription>
              {t('login.welcomeSub', 'Ingresa con tu cuenta para acceder al panel')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium">
                  {t('login.email')}
                </label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium">
                  {t('login.password')}
                </label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              {error && (
                <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <Button
                type="submit"
                className="w-full bg-ember text-cream hover:bg-ember/90"
                disabled={loading}
              >
                {loading ? <Spinner /> : t('login.submit')}
              </Button>
            </form>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

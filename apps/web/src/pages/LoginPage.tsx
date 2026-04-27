import { useRef, useState } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertCircle } from 'lucide-react';
import { z } from 'zod';
import { Button } from '@/components/ui/button.tsx';
import { Input } from '@/components/ui/input.tsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.tsx';
import { Spinner } from '@/components/ui/spinner.tsx';
import { LanguageSwitcher } from '@/components/ui/language-switcher.tsx';
import { HeroIntro } from '@/components/branding/HeroIntro.tsx';
import { FormField } from '@/components/forms/FormField.tsx';
import { useAuth } from '@/lib/auth-context.tsx';
import { ApiError } from '@/lib/api.ts';
import { useZodForm } from '@/lib/use-zod-form.ts';

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
type LoginValues = z.infer<typeof LoginSchema>;

export function LoginPage() {
  const { t } = useTranslation();
  const { status, login } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const formRef = useRef<HTMLDivElement>(null);

  const [serverError, setServerError] = useState<string | null>(null);

  const form = useZodForm(LoginSchema, {
    defaultValues: { email: 'admin@brasabrava.local', password: '' },
  });

  if (status === 'authenticated') {
    const redirectTo = (loc.state as { from?: string } | null)?.from ?? '/catalog';
    return <Navigate to={redirectTo} replace />;
  }

  const onSubmit = async (values: LoginValues): Promise<void> => {
    setServerError(null);
    try {
      await login(values.email, values.password);
      nav((loc.state as { from?: string } | null)?.from ?? '/catalog', { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setServerError(t(`errors.${err.body.code}`, t('errors.INTERNAL')));
      } else {
        setServerError(t('errors.INTERNAL'));
      }
    }
  };

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
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
              <FormField
                label={t('login.email')}
                htmlFor="email"
                error={form.formState.errors.email?.message}
                required
              >
                <Input
                  id="email"
                  type="email"
                  autoComplete="username"
                  {...form.register('email')}
                />
              </FormField>

              <FormField
                label={t('login.password')}
                htmlFor="password"
                error={form.formState.errors.password?.message}
                required
              >
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  {...form.register('password')}
                />
              </FormField>

              {serverError && (
                <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{serverError}</span>
                </div>
              )}

              <Button
                type="submit"
                className="w-full bg-ember text-cream hover:bg-ember/90"
                disabled={form.formState.isSubmitting}
              >
                {form.formState.isSubmitting ? <Spinner /> : t('login.submit')}
              </Button>
            </form>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

import { useTranslation } from 'react-i18next';
import { Languages } from 'lucide-react';
import { setLocale, SUPPORTED_LOCALES, type SupportedLocale } from '@/i18n/index.ts';
import { Button } from './button.tsx';

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const current = (i18n.resolvedLanguage ?? 'es') as SupportedLocale;
  const next: SupportedLocale = current === 'es' ? 'en' : 'es';

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setLocale(next)}
      aria-label={t('language.label')}
      data-testid={`lang-switcher-${next}`}
    >
      <Languages className="mr-2 h-4 w-4" />
      {SUPPORTED_LOCALES.map((loc) => (
        <span
          key={loc}
          className={loc === current ? 'font-semibold' : 'text-muted-foreground'}
        >
          {loc.toUpperCase()}
          {loc !== SUPPORTED_LOCALES[SUPPORTED_LOCALES.length - 1] && (
            <span className="mx-1 text-muted-foreground">·</span>
          )}
        </span>
      ))}
    </Button>
  );
}

import { useTranslation } from 'react-i18next';
import { Banknote, AlertTriangle, ClipboardList, TrendingDown } from 'lucide-react';

export function Dashboard() {
  const { t } = useTranslation('dashboard');
  const { t: tc } = useTranslation();
  const kpis = [
    { key: 'stockValue', icon: Banknote, value: '—', tone: 'text-foreground' },
    { key: 'lowStockItems', icon: AlertTriangle, value: '—', tone: 'text-warning' },
    { key: 'openAudits', icon: ClipboardList, value: '—', tone: 'text-foreground' },
    { key: 'monthVariance', icon: TrendingDown, value: '—', tone: 'text-foreground' },
  ] as const;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </header>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.key} className="rounded-lg border bg-card p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{t(`kpis.${k.key}`)}</p>
              <k.icon className={`h-5 w-5 ${k.tone}`} />
            </div>
            <p className="mt-2 text-3xl font-semibold tabular-nums">{k.value}</p>
          </div>
        ))}
      </section>

      <section className="rounded-lg border bg-card p-8 text-center">
        <h2 className="text-lg font-semibold">{t('empty.title')}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t('empty.body')}</p>
        <p className="mt-6 text-xs text-muted-foreground">
          {tc('app.name')} · v0.1 — Phase 1 (Foundation)
        </p>
      </section>
    </div>
  );
}

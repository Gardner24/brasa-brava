import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { History, RefreshCcw, Filter } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.tsx';
import { Input } from '@/components/ui/input.tsx';
import { Select } from '@/components/ui/select.tsx';
import { Badge } from '@/components/ui/badge.tsx';
import { Button } from '@/components/ui/button.tsx';
import { Skeleton } from '@/components/ui/skeleton.tsx';
import { useAuditLog } from '@/lib/queries.ts';

const ENTITIES = ['', 'product', 'recipe', 'recipe_lines', 'product_alias', 'product_category', 'user'];
const ACTIONS = ['', 'INSERT', 'UPDATE', 'DELETE', 'LOGIN', 'LOGIN_FAILED', 'LOGOUT'];

export function AuditLogPage() {
  const { t } = useTranslation('audit');
  const [entity, setEntity] = useState('');
  const [action, setAction] = useState('');
  const [page, setPage] = useState(1);

  const log = useAuditLog({
    ...(entity ? { entity } : {}),
    ...(action ? { action } : {}),
    page,
    pageSize: 50,
  });

  return (
    <div className="space-y-4">
      <header>
        <h1 className="font-display text-3xl">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Filter className="h-4 w-4" />
            {t('filters')}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Select value={entity} onChange={(e) => { setEntity(e.target.value); setPage(1); }}>
            <option value="">{t('allEntities')}</option>
            {ENTITIES.filter(Boolean).map((e) => (
              <option key={e} value={e}>{e}</option>
            ))}
          </Select>
          <Select value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }}>
            <option value="">{t('allActions')}</option>
            {ACTIONS.filter(Boolean).map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </Select>
          <Button variant="outline" onClick={() => log.refetch()}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            {t('refresh')}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {log.isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : log.data?.data.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <History className="h-10 w-10 opacity-30" />
              <p className="mt-2 text-sm">{t('empty')}</p>
            </div>
          ) : (
            <ul className="divide-y">
              {log.data?.data.map((entry) => (
                <li key={entry.id} className="px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm">
                      <Badge variant={actionVariant(entry.action)}>{entry.action}</Badge>
                      <span className="font-mono text-xs text-muted-foreground">{entry.entity}</span>
                      <span className="text-xs text-muted-foreground">·</span>
                      <span className="font-mono text-xs">{entry.entityId.slice(0, 8)}</span>
                    </div>
                    <time className="text-xs text-muted-foreground" dateTime={entry.occurredAt}>
                      {new Date(entry.occurredAt).toLocaleString()}
                    </time>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {entry.actorEmail} · {entry.ipAddress ?? '-'}
                  </p>
                  {entry.diffJson != null && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs text-brand">{t('viewDiff')}</summary>
                      <pre className="mt-2 max-h-60 overflow-auto rounded-md bg-muted p-2 text-xs">
                        {JSON.stringify(entry.diffJson, null, 2)}
                      </pre>
                    </details>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
        <div className="flex items-center justify-between border-t bg-muted/20 px-4 py-2 text-sm">
          <span className="text-muted-foreground">
            {t('showing', { count: log.data?.data.length ?? 0, total: log.data?.total ?? 0 })}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              {t('prev')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={(log.data?.data.length ?? 0) < 50}
              onClick={() => setPage((p) => p + 1)}
            >
              {t('next')}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

function actionVariant(a: string): 'default' | 'secondary' | 'destructive' | 'success' | 'warning' | 'outline' {
  if (a === 'INSERT') return 'success';
  if (a === 'DELETE') return 'destructive';
  if (a === 'LOGIN_FAILED') return 'destructive';
  if (a === 'LOGIN') return 'success';
  if (a === 'UPDATE') return 'default';
  return 'secondary';
}

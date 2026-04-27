import { useTranslation } from 'react-i18next';
import { LogOut, UserCircle2 } from 'lucide-react';
import { LanguageSwitcher } from '../ui/language-switcher.tsx';
import { Button } from '../ui/button.tsx';
import { useAuth } from '@/lib/auth-context.tsx';

export function Topbar() {
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  return (
    <header className="flex h-16 items-center justify-between border-b border-border/60 bg-card px-6">
      <div className="text-sm text-muted-foreground" />
      <div className="flex items-center gap-3">
        <LanguageSwitcher />
        {user && (
          <div className="flex items-center gap-2 rounded-full bg-ember/10 px-3 py-1.5 text-sm">
            <UserCircle2 className="h-4 w-4 text-ember-dim" />
            <span className="font-medium text-ember-dim">{user.fullName}</span>
            <span className="text-xs text-ember-dim/70">·</span>
            <span className="text-xs uppercase tracking-wider text-ember-dim/80">
              {user.roles[0]}
            </span>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => void logout()}
          aria-label={t('actions.logout', 'Cerrar sesión')}
        >
          <LogOut className="h-5 w-5" />
        </Button>
      </div>
    </header>
  );
}

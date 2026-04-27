import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronsDown } from 'lucide-react';
import { Button } from '@/components/ui/button.tsx';

interface Props {
  /** Ref al elemento al que el botón "Entrar" hará scroll. */
  onEnterClick: () => void;
  /** Tagline opcional debajo del título. */
  tagline?: string;
  /** Subtítulo del cuerpo */
  subtitle?: string;
  /** Botón secundario opcional */
  secondaryAction?: { label: string; onClick: () => void };
}

/**
 * Sección hero a pantalla completa con identidad de parrilla.
 * SVG inline (sin dependencias de imágenes externas) que dibuja
 * brasas y rejilla al pie. Se usa al inicio de la LoginPage y
 * opcionalmente como portada de Dashboard.
 */
export function HeroIntro({ onEnterClick, tagline, subtitle, secondaryAction }: Props) {
  const { t } = useTranslation();
  const heroRef = useRef<HTMLElement>(null);

  return (
    <section
      ref={heroRef}
      className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-charcoal px-6 py-20 text-cream"
    >
      <BackgroundEmbers />

      <div className="relative z-10 mx-auto max-w-2xl text-center">
        <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-ember-light/30 px-4 py-1.5">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-ember-light" />
          <span className="text-[11px] uppercase tracking-[0.2em] text-ember-light">
            {t('hero.eyebrow', 'Parrilla · Eventos')}
          </span>
        </div>

        <h1 className="font-display text-6xl font-medium leading-none tracking-tight text-cream sm:text-7xl">
          Brasa Brava
        </h1>

        <p className="mt-4 text-[13px] uppercase tracking-[0.32em] text-ember">
          {tagline ?? t('hero.tagline', 'Inventario · Auditoría · Costeo')}
        </p>

        <p className="mx-auto mt-7 max-w-lg text-base leading-relaxed text-cream/70">
          {subtitle ?? t('hero.subtitle', 'Del Excel al sistema. Cada gramo contado, cada colón trazado, cada cambio auditado. Para que la brasa sea brava donde importa: en la parrilla.')}
        </p>

        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <Button
            onClick={onEnterClick}
            className="bg-ember px-7 text-cream hover:bg-ember/90"
            size="lg"
          >
            {t('hero.enter', 'Entrar al panel')}
          </Button>
          {secondaryAction && (
            <Button
              onClick={secondaryAction.onClick}
              variant="outline"
              size="lg"
              className="border-cream/35 bg-transparent text-cream hover:bg-cream/10 hover:text-cream"
            >
              {secondaryAction.label}
            </Button>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={onEnterClick}
        aria-label={t('hero.scrollDown', 'Bajar')}
        className="relative z-10 mt-14 flex flex-col items-center gap-2 text-cream/50 transition-colors hover:text-cream"
      >
        <span className="text-[11px] uppercase tracking-[0.2em]">
          {t('hero.scroll', 'scroll')}
        </span>
        <ChevronsDown className="h-5 w-5 animate-brasa-bounce" />
      </button>
    </section>
  );
}

/** SVG de fondo: brasas y rejilla de parrilla. Sin deps externas. */
function BackgroundEmbers() {
  return (
    <svg
      viewBox="0 0 680 800"
      preserveAspectRatio="xMidYMid slice"
      className="pointer-events-none absolute inset-0 h-full w-full opacity-55"
      aria-hidden
    >
      <defs>
        <radialGradient id="brasa-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#f4a44b" stopOpacity="0.95" />
          <stop offset="60%" stopColor="#d4451f" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#14100c" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect x="0" y="0" width="680" height="800" fill="#14100c" />
      {/* Halos cálidos */}
      <circle cx="120" cy="700" r="240" fill="url(#brasa-glow)" />
      <circle cx="540" cy="720" r="280" fill="url(#brasa-glow)" />
      <circle cx="340" cy="780" r="180" fill="url(#brasa-glow)" />
      {/* Chispas */}
      <g fill="#f4a44b" opacity="0.65">
        <circle cx="80" cy="600" r="2" />
        <circle cx="140" cy="540" r="1.5" />
        <circle cx="220" cy="640" r="2.5" />
        <circle cx="290" cy="570" r="1.5" />
        <circle cx="360" cy="660" r="2" />
        <circle cx="440" cy="600" r="2.5" />
        <circle cx="510" cy="650" r="1.5" />
        <circle cx="600" cy="610" r="2" />
        <circle cx="180" cy="490" r="1" />
        <circle cx="380" cy="500" r="1.2" />
        <circle cx="500" cy="540" r="1.5" />
        <circle cx="620" cy="490" r="1" />
        <circle cx="60" cy="450" r="1" />
        <circle cx="320" cy="430" r="1.3" />
      </g>
      {/* Rejilla de parrilla al pie */}
      <g stroke="#3a2920" strokeWidth="0.6" opacity="0.45">
        <line x1="0" y1="770" x2="680" y2="770" />
        <line x1="0" y1="755" x2="680" y2="755" />
        <line x1="0" y1="740" x2="680" y2="740" />
        <line x1="80" y1="735" x2="80" y2="800" />
        <line x1="200" y1="735" x2="200" y2="800" />
        <line x1="340" y1="735" x2="340" y2="800" />
        <line x1="480" y1="735" x2="480" y2="800" />
        <line x1="600" y1="735" x2="600" y2="800" />
      </g>
    </svg>
  );
}

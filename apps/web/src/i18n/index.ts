/**
 * Inicialización de i18next con detección de idioma del navegador,
 * cambio en vivo y persistencia en localStorage.
 */
import i18next from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';

import esCommon from './locales/es/common.json';
import esDashboard from './locales/es/dashboard.json';
import esCatalog from './locales/es/catalog.json';
import esRecipes from './locales/es/recipes.json';
import esAudit from './locales/es/audit.json';
import esInventory from './locales/es/inventory.json';
import esMovements from './locales/es/movements.json';
import enCommon from './locales/en/common.json';
import enDashboard from './locales/en/dashboard.json';
import enCatalog from './locales/en/catalog.json';
import enRecipes from './locales/en/recipes.json';
import enAudit from './locales/en/audit.json';
import enInventory from './locales/en/inventory.json';
import enMovements from './locales/en/movements.json';

export const SUPPORTED_LOCALES = ['es', 'en'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

void i18next
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'es',
    supportedLngs: SUPPORTED_LOCALES as unknown as string[],
    ns: ['common', 'dashboard', 'catalog', 'recipes', 'audit', 'inventory', 'movements'],
    defaultNS: 'common',
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'brasa.locale',
    },
    interpolation: { escapeValue: false },
    resources: {
      es: {
        common: esCommon,
        dashboard: esDashboard,
        catalog: esCatalog,
        recipes: esRecipes,
        audit: esAudit,
        inventory: esInventory,
        movements: esMovements,
      },
      en: {
        common: enCommon,
        dashboard: enDashboard,
        catalog: enCatalog,
        recipes: enRecipes,
        audit: enAudit,
        inventory: enInventory,
        movements: enMovements,
      },
    },
  });

export const i18n = i18next;

export function setLocale(locale: SupportedLocale): void {
  void i18n.changeLanguage(locale);
}

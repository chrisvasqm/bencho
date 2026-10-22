// i18next with the copy bundled in: no loading step, so the first render already has the text.
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { storedChoice } from '../features/preferences/storedChoice.ts';
import { en } from './en.ts';
import { es } from './es.ts';

export const LANGUAGES = ['en', 'es'] as const;
export type Language = (typeof LANGUAGES)[number];

export const LANGUAGE_STORAGE_KEY = 'language';

const browserLanguage = (): Language =>
  typeof navigator !== 'undefined' && navigator.language.toLowerCase().startsWith('es')
    ? 'es'
    : 'en';

const language = storedChoice<Language>(
  LANGUAGE_STORAGE_KEY,
  LANGUAGES,
  browserLanguage,
  (next) => {
    document.documentElement.lang = next;
    void i18n.changeLanguage(next);
  },
);

export const useLanguage = language.use;

const initial = language.read();
document.documentElement.lang = initial;

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, es: { translation: es } },
  lng: initial,
  fallbackLng: 'en',
  initAsync: false,
  // React escapes text already; escaping here would show step names such as "A & B" as "A &amp; B".
  interpolation: { escapeValue: false },
  returnNull: false,
});

declare module 'i18next' {
  interface CustomTypeOptions {
    resources: { translation: typeof en };
  }
}

export { i18n };

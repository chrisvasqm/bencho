import { cn } from '../../components/ui/index.ts';
import { LANGUAGES, useLanguage } from '../../i18n/index.ts';
import { useCopy } from '../../i18n/useCopy.ts';

/**
 * One button that looks like the EN / ES pair: a click anywhere moves to the next language.
 * It is a plain button, not a radio group, so a click on the highlighted side is not a surprise.
 */
export function LanguageSwitch() {
  const { t } = useCopy();
  const [language, setLanguage] = useLanguage();
  const next = LANGUAGES[(LANGUAGES.indexOf(language) + 1) % LANGUAGES.length] ?? language;
  return (
    <button
      type="button"
      data-testid="language"
      data-language={language}
      onClick={() => setLanguage(next)}
      className="group inline-flex rounded-md bg-surface-sunken p-0.5"
    >
      {/* The name reads "Language: EN ES — change to Spanish": it keeps the visible text for voice control. */}
      <span className="sr-only">{t('prefs.language')}: </span>
      {LANGUAGES.map((value) => (
        <span
          key={value}
          data-testid={`language-${value}`}
          className={cn(
            'rounded-[5px] px-2.5 py-1 text-xs font-medium transition-colors',
            value === language ? 'bg-surface text-fg' : 'text-fg-muted group-hover:text-fg',
          )}
        >
          {value.toUpperCase()}
        </span>
      ))}
      <span className="sr-only">
        — {t('prefs.switchLanguage', { language: t(`prefs.languages.${next}`) })}
      </span>
    </button>
  );
}

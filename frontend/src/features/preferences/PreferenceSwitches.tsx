import { SegmentedControl, cn } from '../../components/ui/index.ts';
import { LANGUAGES, useLanguage } from '../../i18n/index.ts';
import { useCopy } from '../../i18n/useCopy.ts';
import { DETAILS, useDetail } from './detail.ts';

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
      aria-label={t('prefs.switchLanguage', { language: t(`prefs.languages.${next}`) })}
      onClick={() => setLanguage(next)}
      className="inline-flex rounded-md bg-surface-sunken p-0.5"
    >
      {LANGUAGES.map((value) => (
        <span
          key={value}
          aria-hidden
          data-testid={`language-${value}`}
          className={cn(
            'rounded-[5px] px-2.5 py-1 text-xs font-medium transition-colors',
            value === language ? 'bg-surface text-fg' : 'text-fg-muted',
          )}
        >
          {value.toUpperCase()}
        </span>
      ))}
    </button>
  );
}

export function DetailSwitch() {
  const { t } = useCopy();
  const [detail, setDetail] = useDetail();
  return (
    <span title={t('prefs.detailHint')}>
      <SegmentedControl
        label={t('prefs.detail')}
        testId="detail"
        value={detail}
        onChange={setDetail}
        options={DETAILS.map((value) => ({ value, label: t(`prefs.details.${value}`) }))}
      />
    </span>
  );
}

import { SegmentedControl } from '../../components/ui/index.ts';
import { LANGUAGES, useLanguage } from '../../i18n/index.ts';
import { useCopy } from '../../i18n/useCopy.ts';
import { DETAILS, useDetail } from './detail.ts';

export function LanguageSwitch() {
  const { t } = useCopy();
  const [language, setLanguage] = useLanguage();
  // Two languages only, so any click (even on the current one) flips to the other.
  const toggle = () => setLanguage(language === 'en' ? 'es' : 'en');
  return (
    <SegmentedControl
      label={t('prefs.language')}
      testId="language"
      value={language}
      onChange={toggle}
      options={LANGUAGES.map((value) => ({ value, label: value.toUpperCase() }))}
    />
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

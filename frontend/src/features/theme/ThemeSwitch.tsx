import { SegmentedControl } from '../../components/ui/index.ts';
import { useCopy } from '../../i18n/useCopy.ts';
import { THEMES, useTheme } from './theme.ts';

export function ThemeSwitch() {
  const { t } = useCopy();
  const [theme, setTheme] = useTheme();
  return (
    <SegmentedControl
      label={t('prefs.theme')}
      testId="theme"
      value={theme}
      onChange={setTheme}
      options={THEMES.map((value) => ({ value, label: t(`prefs.themes.${value}`) }))}
    />
  );
}

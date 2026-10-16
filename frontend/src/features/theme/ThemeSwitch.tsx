import { SegmentedControl } from '../../components/ui/index.ts';
import { THEMES, useTheme, type Theme } from './theme.ts';

const LABELS: Record<Theme, string> = { system: 'System', light: 'Light', dark: 'Dark' };

export function ThemeSwitch() {
  const [theme, setTheme] = useTheme();
  return (
    <SegmentedControl
      label="Theme"
      value={theme}
      onChange={setTheme}
      options={THEMES.map((value) => ({ value, label: LABELS[value] }))}
    />
  );
}

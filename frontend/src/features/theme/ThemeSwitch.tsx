import { useCopy } from '../../i18n/useCopy.ts';
import { chooseTheme, useResolvedTheme, useTheme } from './theme.ts';

/**
 * One icon button: the sun shows in light mode, the moon in dark mode, and a click flips to the other.
 * Flipping to the OS theme clears the stored choice, so the app follows the OS again.
 * No text, so its width stays the same in every language.
 */
export function ThemeSwitch() {
  const { t } = useCopy();
  const [, setTheme] = useTheme();
  const resolved = useResolvedTheme();
  const next = resolved === 'dark' ? 'light' : 'dark';
  const label = t(`prefs.switchTheme.${next}`);
  return (
    <button
      type="button"
      data-testid="theme"
      data-theme={resolved}
      aria-label={`${t('prefs.theme')}: ${label}`}
      title={label}
      onClick={() => setTheme(chooseTheme(next))}
      className="inline-flex size-8 items-center justify-center rounded-md bg-surface-sunken text-fg-muted transition-colors hover:text-fg"
    >
      <svg
        viewBox="0 0 24 24"
        className="size-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {resolved === 'dark' ? (
          <path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401" />
        ) : (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
          </>
        )}
      </svg>
    </button>
  );
}

// Theme choice: system (follow the OS) until the user picks light or dark; then the choice stays. Stored per browser; applied as data-theme on <html>.
// index.html applies the stored choice before first paint so the page never flashes the wrong theme.
import { useCallback, useSyncExternalStore } from 'react';

export const THEMES = ['system', 'light', 'dark'] as const;
export type Theme = (typeof THEMES)[number];
export type ResolvedTheme = Exclude<Theme, 'system'>;

export const THEME_STORAGE_KEY = 'theme';
const listeners = new Set<() => void>();

function isTheme(value: unknown): value is Theme {
  return THEMES.includes(value as Theme);
}

export function readTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return isTheme(stored) ? stored : 'system';
  } catch {
    return 'system';
  }
}

export function applyTheme(theme: Theme): void {
  if (theme === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', theme);
}

function writeTheme(theme: Theme): void {
  try {
    if (theme === 'system') localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Storage blocked: the choice still applies for this page view.
  }
  applyTheme(theme);
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === THEME_STORAGE_KEY) {
      applyTheme(readTheme());
      listener();
    }
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

let darkQuery: MediaQueryList | undefined;
function systemQuery(): MediaQueryList {
  darkQuery ??= window.matchMedia('(prefers-color-scheme: dark)');
  return darkQuery;
}

function subscribeSystem(listener: () => void): () => void {
  systemQuery().addEventListener('change', listener);
  return () => systemQuery().removeEventListener('change', listener);
}

/** The theme on screen (the stored choice, else the OS preference) and a flip to the other one. */
export function useResolvedTheme(): [ResolvedTheme, () => void] {
  const [theme, setTheme] = useTheme();
  const systemDark = useSyncExternalStore(
    subscribeSystem,
    () => systemQuery().matches,
    () => false,
  );
  const resolved: ResolvedTheme = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;
  const toggle = useCallback(
    () => setTheme(resolved === 'dark' ? 'light' : 'dark'),
    [resolved, setTheme],
  );
  return [resolved, toggle];
}

export function useTheme(): [Theme, (theme: Theme) => void] {
  const theme = useSyncExternalStore(subscribe, readTheme, () => 'system' as Theme);
  const setTheme = useCallback((next: Theme) => writeTheme(next), []);
  return [theme, setTheme];
}

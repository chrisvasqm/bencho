// A choice from a fixed list, stored per browser and shared by every component that reads it.
import { useCallback, useSyncExternalStore } from 'react';

export interface StoredChoice<T extends string> {
  read: () => T;
  write: (value: T) => void;
  use: () => [T, (value: T) => void];
}

export function storedChoice<T extends string>(
  key: string,
  values: readonly T[],
  fallback: () => T,
  apply: (value: T) => void = () => undefined,
): StoredChoice<T> {
  const listeners = new Set<() => void>();
  const read = (): T => {
    try {
      const stored = localStorage.getItem(key);
      return values.includes(stored as T) ? (stored as T) : fallback();
    } catch {
      return fallback();
    }
  };
  const write = (value: T) => {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Storage blocked: the choice still applies for this page view.
    }
    apply(value);
    for (const listener of listeners) listener();
  };
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    const onStorage = (event: StorageEvent) => {
      if (event.key !== key) return;
      apply(read());
      listener();
    };
    window.addEventListener('storage', onStorage);
    return () => {
      listeners.delete(listener);
      window.removeEventListener('storage', onStorage);
    };
  };
  const use = (): [T, (value: T) => void] => {
    const value = useSyncExternalStore(subscribe, read, fallback);
    return [value, useCallback((next: T) => write(next), [])];
  };
  return { read, write, use };
}

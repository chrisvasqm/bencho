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
  const load = (): T => {
    try {
      const stored = localStorage.getItem(key);
      return values.includes(stored as T) ? (stored as T) : fallback();
    } catch {
      return fallback();
    }
  };
  // Read once and kept here, so the many components that read the choice never touch storage.
  let current = load();
  const notify = () => {
    for (const listener of listeners) listener();
  };
  const read = (): T => current;
  const write = (value: T) => {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Storage blocked: the choice still applies for this page view.
    }
    current = value;
    apply(value);
    notify();
  };
  // One listener for changes made in other tabs, shared by every subscriber.
  window.addEventListener('storage', (event) => {
    if (event.key !== key) return;
    current = load();
    apply(current);
    notify();
  });
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };
  const use = (): [T, (value: T) => void] => {
    const value = useSyncExternalStore(subscribe, read, fallback);
    return [value, useCallback((next: T) => write(next), [])];
  };
  return { read, write, use };
}

import { useEffect, useState } from 'react';

const PREFIX = 'cim.';

export function readStored<T>(key: string, fallback: T, isValid?: (value: unknown) => boolean): T {
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    if (raw === null) return fallback;
    const value = JSON.parse(raw) as unknown;
    return isValid && !isValid(value) ? fallback : (value as T);
  } catch {
    return fallback;
  }
}

/** useState that survives reloads. Storage failures (private mode, quota) are ignored. */
export function usePersistentState<T>(key: string, initial: T, isValid?: (value: unknown) => boolean) {
  const [value, setValue] = useState<T>(() => readStored(key, initial, isValid));
  useEffect(() => {
    try {
      window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch {
      // Not critical: the app keeps working for this session.
    }
  }, [key, value]);
  return [value, setValue] as const;
}

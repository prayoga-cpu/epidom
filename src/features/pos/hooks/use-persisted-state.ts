import { useEffect, useRef, useState } from "react";

/**
 * Persists a plain JSON-serializable object to localStorage, scoped by key
 * (callers pass a storeId-qualified key so multi-store owners get separate
 * saved filters per store). Initial state is always the caller's defaults
 * (matching what the server rendered) — the saved value, if any, is applied
 * in a mount-only effect, avoiding a hydration mismatch at the cost of one
 * extra render right after mount when a saved value exists.
 *
 * `sanitize` merges the parsed JSON over the defaults field-by-field (rather
 * than trusting the parsed blob wholesale) so a value from an older shape —
 * a removed field, a since-renamed key — can't leave the UI in a broken
 * state after a deploy.
 */
export function usePersistedState<T extends object>(
  key: string,
  defaults: T,
  sanitize: (raw: unknown, defaults: T) => T
) {
  const [state, setState] = useState<T>(defaults);
  // Guards the write-effect's own first invocation — it always fires once on
  // mount (React runs every effect at least once), before the read-effect's
  // setState (if any) has actually applied. Skipping that first write is
  // what stops it from clobbering a just-loaded saved value with defaults;
  // this is independent of read/write effect ordering since each effect
  // checks its *own* first run via this ref.
  const isFirstWrite = useRef(true);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw !== null) {
        setState(sanitize(JSON.parse(raw), defaults));
      }
    } catch {
      // Ignore malformed/blocked storage — keep defaults.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    if (isFirstWrite.current) {
      isFirstWrite.current = false;
      return;
    }
    try {
      window.localStorage.setItem(key, JSON.stringify(state));
    } catch {
      // Ignore quota/blocked storage errors — persistence is best-effort.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, state]);

  return [state, setState] as const;
}

import { useEffect, useState } from 'react';

/**
 * Ritarda la propagazione di un valore. Serve alla ricerca: senza,
 * ogni tasto premuto sarebbe una chiamata a due API.
 */
export function useDebounced<T>(value: T, delayMs = 400): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);

  return debounced;
}

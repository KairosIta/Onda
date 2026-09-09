import { useSyncExternalStore } from 'react';
import { readJSON, writeJSON } from '@/services/storage';
import { dropQuery, loadQueries, pushQuery } from '@/utils/recentQueries';

/**
 * Le ultime ricerche, per rifarle con un tocco quando la casella e' vuota.
 * Restano sul telefono come tutto il resto; la regola sta in
 * `utils/recentQueries`.
 */

const KEY = 'search.recent.v1';

let state: string[] = loadQueries(readJSON(KEY));
const listeners = new Set<() => void>();

function commit(next: string[]): void {
  state = next;
  writeJSON(KEY, state);
  listeners.forEach((l) => l());
}

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export function useRecentSearches(): string[] {
  return useSyncExternalStore(subscribe, () => state);
}

export function rememberSearch(query: string): void {
  const next = pushQuery(state, query);
  // Gia' in testa: la stessa ricerca che carica un'altra pagina non
  // riscrive niente.
  if (next === state || (next[0] === state[0] && next.length === state.length)) return;
  commit(next);
}

export function forgetSearch(query: string): void {
  commit(dropQuery(state, query));
}

export function clearSearches(): void {
  if (state.length > 0) commit([]);
}

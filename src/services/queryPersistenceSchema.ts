/**
 * Cosa della cache di React Query vale la pena tenere su disco fra un
 * avvio e l'altro, e in che misura. Modulo puro: la forma disidratata di
 * TanStack e' JSON semplice, quindi la potatura si verifica in Node.
 *
 * Lo scopo e' un'apertura senza sagome: il trending e le pagine gia'
 * visitate compaiono subito da disco mentre la rete le rinfresca. Non e'
 * una cache offline e non finge di esserlo: i dati scaduti si scartano.
 */

/**
 * Tre giorni: il trending cambia ogni giorno, ma un elenco di ieri
 * mostrato per il secondo che serve alla rete e' meglio di una sagoma.
 * Vale anche come `gcTime`: una query tolta dalla memoria sparirebbe anche
 * dal disco al salvataggio successivo.
 */
export const QUERY_CACHE_MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000;
/** Le piu' recenti: bastano il trending, qualche genere e le ultime pagine aperte. */
export const QUERY_CACHE_MAX_QUERIES = 30;
/**
 * Due pagine per elenco. Al ripristino React Query le ricarica in
 * sequenza prima di mostrare dati freschi: con dieci pagine di scroll
 * sarebbero dieci richieste in fila per un elenco che nessuno ha
 * ancora riscorso.
 */
export const QUERY_CACHE_MAX_PAGES = 2;

/**
 * Radici delle chiavi che si persistono. La ricerca resta fuori: la sua
 * chiave e' il testo digitato, e all'apertura la casella e' vuota.
 */
export const PERSISTED_QUERY_ROOTS: readonly string[] = [
  'trending',
  'spotlight',
  'artist',
  'artist-tracks',
  'album',
  'album-tracks',
];

export const isPersistableKey = (key: readonly unknown[]): boolean =>
  typeof key[0] === 'string' && PERSISTED_QUERY_ROOTS.includes(key[0]);

/** I soli campi che la potatura legge; il resto della query passa intatto. */
export interface PersistedQuery {
  queryKey: readonly unknown[];
  state: { status: string; dataUpdatedAt: number; data?: unknown };
}

export interface PersistedState<Q extends PersistedQuery = PersistedQuery> {
  queries: Q[];
  mutations: unknown[];
}

export interface PruneOptions {
  now: number;
  maxAge?: number;
  maxQueries?: number;
  maxPages?: number;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function trimPages<Q extends PersistedQuery>(query: Q, maxPages: number): Q {
  const data = query.state.data;
  if (!isRecord(data) || !Array.isArray(data.pages) || !Array.isArray(data.pageParams)) {
    return query;
  }
  if (data.pages.length <= maxPages) return query;
  return {
    ...query,
    state: {
      ...query.state,
      data: {
        ...data,
        pages: data.pages.slice(0, maxPages),
        pageParams: data.pageParams.slice(0, maxPages),
      },
    },
  };
}

/** Tiene solo le query riuscite, recenti e persistibili, le piu' fresche per prime. */
export function pruneQueryCache<Q extends PersistedQuery>(
  state: PersistedState<Q>,
  {
    now,
    maxAge = QUERY_CACHE_MAX_AGE_MS,
    maxQueries = QUERY_CACHE_MAX_QUERIES,
    maxPages = QUERY_CACHE_MAX_PAGES,
  }: PruneOptions,
): PersistedState<Q> {
  const queries = state.queries
    .filter(
      (q) =>
        isPersistableKey(q.queryKey) &&
        q.state.status === 'success' &&
        Number.isFinite(q.state.dataUpdatedAt) &&
        now - q.state.dataUpdatedAt <= maxAge,
    )
    .sort((a, b) => b.state.dataUpdatedAt - a.state.dataUpdatedAt)
    .slice(0, maxQueries)
    .map((q) => trimPages(q, maxPages));
  // Le mutazioni non si persistono: l'app non ne usa.
  return { queries, mutations: [] };
}

/**
 * Rilegge da disco. Il file lo abbiamo scritto noi, ma puo' venire da una
 * versione precedente dell'app: si controlla la forma e si pota di nuovo,
 * perche' nel frattempo il tempo e' passato.
 */
export function loadQueryCache(value: unknown, now: number): PersistedState | null {
  if (!isRecord(value) || !Array.isArray(value.queries)) return null;
  const queries = value.queries.filter(
    (q): q is PersistedQuery =>
      isRecord(q) &&
      Array.isArray(q.queryKey) &&
      isRecord(q.state) &&
      typeof q.state.status === 'string' &&
      typeof q.state.dataUpdatedAt === 'number',
  );
  const pruned = pruneQueryCache({ queries, mutations: [] }, { now });
  return pruned.queries.length > 0 ? pruned : null;
}

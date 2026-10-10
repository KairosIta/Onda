/**
 * Cosa della cache di React Query vale la pena tenere su disco fra un
 * avvio e l'altro, e in che misura. Modulo puro: la forma disidratata di
 * TanStack e' JSON semplice, quindi la potatura si verifica in Node.
 *
 * Lo scopo e' un'apertura senza sagome: il trending e le pagine gia'
 * visitate compaiono subito da disco mentre la rete le rinfresca. Non e'
 * una cache offline e non finge di esserlo: i dati scaduti si scartano.
 */

import type { SourceId } from '@/types/track';

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

/**
 * Sorgenti i cui dati non vanno su disco. Gli API Terms di Audius (2 luglio
 * 2025) ammettono solo una cache di sessione: cio' che si tiene in cache
 * deve diventare inaccessibile quando la sessione finisce. Le loro query
 * restano in memoria finche' l'app e' aperta, come tutte, ma non si
 * scrivono e non si rileggono.
 */
export const SESSION_ONLY_SOURCES: readonly SourceId[] = ['audius'];

const isSessionOnly = (value: unknown): boolean =>
  typeof value === 'string' && (SESSION_ONLY_SOURCES as readonly string[]).includes(value);

/**
 * I soli campi che la potatura legge; il resto della query passa intatto.
 *
 * `queryHash` non lo legge nessuno qui, ma e' la chiave con cui React Query
 * ritrova la query al ripristino: senza, la voce riletta da disco non
 * servirebbe a niente, quindi si pretende insieme agli altri.
 */
export interface PersistedQuery {
  queryKey: readonly unknown[];
  queryHash: string;
  state: {
    status: string;
    dataUpdatedAt: number;
    data?: unknown;
    /** Vero, React Query considera i dati scaduti e li rinfresca al primo uso. */
    isInvalidated?: boolean;
  };
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

/** La forma minima di una query letta da disco, quella che la potatura legge. */
export const isPersistedQuery = (q: unknown): q is PersistedQuery =>
  isRecord(q) &&
  Array.isArray(q.queryKey) &&
  typeof q.queryHash === 'string' &&
  isRecord(q.state) &&
  typeof q.state.status === 'string' &&
  typeof q.state.dataUpdatedAt === 'number';

/** Il contenitore senza i brani delle sorgenti di sola sessione; `null` se non ne aveva. */
function stripTracks(holder: Record<string, unknown>): Record<string, unknown> | null {
  const tracks = holder.tracks;
  if (!Array.isArray(tracks)) return null;
  const kept = tracks.filter((t) => !(isRecord(t) && isSessionOnly(t.source)));
  return kept.length === tracks.length ? null : { ...holder, tracks: kept };
}

/**
 * La query come puo' stare su disco, oppure `null` se non puo' starci.
 *
 * Profili, album e i loro brani hanno la sorgente nella chiave
 * (`['album', 'audius', id]`): quelli di una sorgente di sola sessione
 * restano fuori interi. Gli elenchi federati (trending, generi, vetrine)
 * restano senza i brani di quelle sorgenti e segnati da rinfrescare: alla
 * riapertura mostrano subito il resto e tornano completi appena risponde
 * la rete, anche se non sono ancora scaduti.
 */
export function withoutSessionOnly<Q extends PersistedQuery>(query: Q): Q | null {
  if (isSessionOnly(query.queryKey[1])) return null;
  const data = query.state.data;
  if (!isRecord(data)) return query;

  // Una vetrina porta i brani in `tracks`, un elenco a scorrimento in
  // ogni pagina.
  let next = stripTracks(data);
  if (Array.isArray(data.pages)) {
    let touched = false;
    const pages = data.pages.map((page) => {
      const stripped = isRecord(page) ? stripTracks(page) : null;
      if (stripped) touched = true;
      return stripped ?? page;
    });
    if (touched) next = { ...(next ?? data), pages };
  }
  if (!next) return query;
  return { ...query, state: { ...query.state, data: next, isInvalidated: true } };
}

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

/**
 * Tiene solo le query riuscite, recenti e persistibili, senza i dati delle
 * sorgenti di sola sessione, le piu' fresche per prime.
 */
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
    .map((q) => withoutSessionOnly(q))
    .filter((q): q is Q => q !== null)
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
  const queries = value.queries.filter(isPersistedQuery);
  const pruned = pruneQueryCache({ queries, mutations: [] }, { now });
  return pruned.queries.length > 0 ? pruned : null;
}

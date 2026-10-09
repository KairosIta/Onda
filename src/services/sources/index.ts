import type {
  AlbumInfo,
  ArtistInfo,
  ListParams,
  MusicSource,
  SourceId,
  SpotlightKind,
  Track,
} from '@/types/track';
import { genreFor } from '../genres';
import { audiusSource } from './audius';
import {
  advanceCursor,
  combine,
  type FederatedPage,
  type FederatedResult,
  resolveCursor,
  type SourceOutcome,
} from './federation';
import { jamendoSource } from './jamendo';

export type { FederatedPage, FederatedResult } from './federation';

/**
 * Registro delle sorgenti. Metti a false una voce per spegnerla senza
 * toccare il resto dell'app.
 */
export const SOURCES: Record<SourceId, { source: MusicSource; enabled: boolean }> = {
  audius: { source: audiusSource, enabled: true },
  jamendo: { source: jamendoSource, enabled: true },
};

/**
 * Una sorgente spenta non deve restare raggiungibile dalle pagine artista
 * e album: la si cerca per id proprio quando arriva da un deep link o da
 * una traccia salvata, cioe' esattamente i casi in cui non e' passata dal
 * catalogo. Le schermate trattano gia' `undefined` come sorgente ignota.
 */
export const sourceById = (id: string): MusicSource | undefined =>
  (id === 'audius' || id === 'jamendo') && SOURCES[id].enabled ? SOURCES[id].source : undefined;

const active = (): MusicSource[] =>
  Object.values(SOURCES)
    .filter((s) => s.enabled)
    .map((s) => s.source);

/**
 * `call` ritorna `null` per una sorgente che non offre quella funzione:
 * viene saltata, non contata come caduta. Solo se nessuna la offre il
 * risultato e' vuoto senza errore.
 *
 * `call` si invoca una volta sola per sorgente: chiamarlo anche solo per
 * sapere se ritorna `null` fa gia' partire la richiesta di rete, e quella
 * scartata resterebbe una promise senza gestore.
 */
async function settle<T>(
  sources: readonly MusicSource[],
  call: (s: MusicSource) => Promise<T[]> | null,
): Promise<SourceOutcome<T>[]> {
  const started = sources
    .map((source) => ({ source, promise: call(source) }))
    .filter((c): c is { source: MusicSource; promise: Promise<T[]> } => c.promise !== null);
  const settled = await Promise.allSettled(started.map((c) => c.promise));
  return started.map(({ source }, i) => ({ source: source.id, result: settled[i] }));
}

async function federate<T>(
  call: (s: MusicSource) => Promise<T[]> | null,
): Promise<FederatedResult<T>> {
  return combine(await settle(active(), call));
}

export interface PageParams {
  limit?: number;
  /** Il `next` della pagina precedente; assente per la prima. */
  cursor?: unknown;
}

/**
 * Una pagina di un elenco a scorrimento: ogni sorgente parte dal proprio
 * offset (vedi `SourceCursor`) e la pagina porta con se' il cursore della
 * successiva.
 */
async function paginate(
  sources: readonly MusicSource[],
  { limit = 20, cursor }: PageParams,
  call: (s: MusicSource, page: ListParams) => Promise<Track[]>,
): Promise<FederatedPage> {
  const from = resolveCursor(
    cursor,
    sources.map((s) => s.id),
  );
  const outcomes = await settle(
    sources.filter((s) => from[s.id] !== undefined),
    (s) => call(s, { limit, offset: from[s.id] }),
  );
  // `combine` lancia se sono cadute tutte: la pagina fallisce intera e la
  // richiesta successiva riparte dallo stesso cursore.
  return { ...combine(outcomes), next: advanceCursor(from, outcomes, limit) };
}

export const searchAll = (query: string, page: PageParams = {}): Promise<FederatedPage> =>
  paginate(active(), page, (s, list) => s.search({ query, ...list }));

export const trendingAll = ({
  genreKey,
  ...page
}: PageParams & { genreKey?: string } = {}): Promise<FederatedPage> =>
  paginate(active(), page, (s, list) => s.trending({ ...list, genre: genreFor(genreKey, s.id) }));

/**
 * I brani di un artista, a pagine. La sorgente e' una sola, ma il cursore
 * e' lo stesso degli elenchi federati: lo scroll infinito ha una regola sola.
 */
export const artistTracksPage = (
  source: MusicSource,
  artistId: string,
  page: PageParams = {},
): Promise<FederatedPage> => paginate([source], page, (s, list) => s.artistTracks(artistId, list));

/** Vetrine di Scopri: poche voci per sorgente, alternate come il resto. */
export const spotlightAll = (
  kind: SpotlightKind,
  params: ListParams = {},
): Promise<FederatedResult> =>
  federate((s) => (s.spotlight ? s.spotlight(kind, { limit: 10, ...params }) : null));

export const searchArtistsAll = (
  query: string,
  params: ListParams = {},
): Promise<FederatedResult<ArtistInfo>> =>
  federate((s) => (s.searchArtists ? s.searchArtists({ query, limit: 8, ...params }) : null));

export const searchAlbumsAll = (
  query: string,
  params: ListParams = {},
): Promise<FederatedResult<AlbumInfo>> =>
  federate((s) => (s.searchAlbums ? s.searchAlbums({ query, limit: 8, ...params }) : null));

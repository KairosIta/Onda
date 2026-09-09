import type {
  AlbumInfo,
  ArtistInfo,
  ListParams,
  MusicSource,
  SourceId,
  SpotlightKind,
} from '@/types/track';
import { genreFor } from '../genres';
import { audiusSource } from './audius';
import { combine, type FederatedResult } from './federation';
import { jamendoSource } from './jamendo';

export type { FederatedResult } from './federation';

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
 */
async function federate<T>(
  call: (s: MusicSource) => Promise<T[]> | null,
): Promise<FederatedResult<T>> {
  const sources = active().filter((s) => call(s) !== null);
  const settled = await Promise.allSettled(sources.map((s) => call(s) as Promise<T[]>));
  return combine(sources.map((source, i) => ({ source: source.id, result: settled[i] })));
}

/**
 * L'offset e' per sorgente, non globale: chiedendo la pagina 2 a
 * entrambe si ottengono comunque risultati nuovi da entrambe.
 */
export const searchAll = (query: string, params: ListParams = {}): Promise<FederatedResult> =>
  federate((s) => s.search({ query, limit: 20, ...params }));

export const trendingAll = (
  params: ListParams & { genreKey?: string } = {},
): Promise<FederatedResult> => {
  const { genreKey, ...list } = params;
  return federate((s) => s.trending({ limit: 20, ...list, genre: genreFor(genreKey, s.id) }));
};

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

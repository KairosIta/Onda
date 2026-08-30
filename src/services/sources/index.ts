import type { ListParams, MusicSource, SourceId, Track } from '@/types/track';
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

async function federate(call: (s: MusicSource) => Promise<Track[]>): Promise<FederatedResult> {
  const sources = active();
  const settled = await Promise.allSettled(sources.map(call));
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

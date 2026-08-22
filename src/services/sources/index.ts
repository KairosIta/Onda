import type { ListParams, MusicSource, SourceId, Track } from '@/types/track';
import { genreFor } from '../genres';
import { audiusSource } from './audius';
import { jamendoSource } from './jamendo';

/**
 * Registro delle sorgenti. Metti a false una voce per spegnerla senza
 * toccare il resto dell'app.
 */
export const SOURCES: Record<SourceId, { source: MusicSource; enabled: boolean }> = {
  audius: { source: audiusSource, enabled: true },
  jamendo: { source: jamendoSource, enabled: true },
};

export const sourceById = (id: string): MusicSource | undefined =>
  id === 'audius' || id === 'jamendo' ? SOURCES[id].source : undefined;

const active = (): MusicSource[] =>
  Object.values(SOURCES)
    .filter((s) => s.enabled)
    .map((s) => s.source);

/**
 * Alterna i risultati delle sorgenti invece di concatenarli: senza questo
 * la prima schermata sarebbe tutta Audius e Jamendo non si vedrebbe mai.
 */
function interleave(lists: Track[][]): Track[] {
  const out: Track[] = [];
  const max = Math.max(0, ...lists.map((l) => l.length));
  for (let i = 0; i < max; i++) {
    for (const list of lists) {
      if (list[i]) out.push(list[i]);
    }
  }
  return out;
}

export interface FederatedResult {
  tracks: Track[];
  /** Sorgenti che hanno fallito: l'app resta usabile, ma lo diciamo. */
  failed: { source: SourceId; message: string }[];
}

/**
 * Su Android un guasto di rete arriva come eccezione Java intera:
 * `fetch failed: java.net.UnknownHostException: Unable to resolve host
 * "api.audius.co": No address associated with hostname`. A schermo sono
 * sei righe che dicono una cosa sola, ripetute per ogni sorgente.
 *
 * Le riduciamo a quella cosa sola. Tutti gli altri messaggi restano
 * interi: una quota esaurita o un'API che e' cambiata e' esattamente
 * quello che si vuole poter leggere per intero.
 */
const NETWORK =
  /unknownhost|unable to resolve host|network request failed|fetch failed|timeout|econnrefused|failed to connect/i;

function describe(reason: unknown): string {
  const message = reason instanceof Error ? reason.message : String(reason ?? '');
  if (!message) return 'errore sconosciuto';
  return NETWORK.test(message) ? 'rete non raggiungibile' : message;
}

async function federate(call: (s: MusicSource) => Promise<Track[]>): Promise<FederatedResult> {
  const sources = active();
  const settled = await Promise.allSettled(sources.map(call));

  const lists: Track[][] = [];
  const failed: FederatedResult['failed'] = [];

  settled.forEach((result, i) => {
    if (result.status === 'fulfilled') {
      lists.push(result.value);
    } else {
      failed.push({ source: sources[i].id, message: describe(result.reason) });
    }
  });

  /**
   * Nessuna sorgente ha risposto: e' un errore, e va propagato come tale.
   *
   * Tornando `{ tracks: [], failed }` sarebbe indistinguibile da un catalogo
   * finito, e chi pagina legge la pagina vuota come "fine elenco": lo scroll
   * infinito si chiuderebbe per sempre su una caduta di rete di un secondo.
   * E' lo stesso equivoco delle liste vuote di Jamendo, un piano piu' in alto.
   */
  if (lists.length === 0 && sources.length > 0) {
    // Se sono cadute tutte per lo stesso motivo — il caso normale, la rete
    // che manca — il motivo si dice una volta. Ripeterlo per sorgente
    // riempirebbe mezza schermata senza aggiungere niente.
    const reasons = new Set(failed.map((f) => f.message));
    throw new Error(
      reasons.size === 1
        ? [...reasons][0]
        : failed.map((f) => `${f.source}: ${f.message}`).join(' · '),
    );
  }

  return { tracks: interleave(lists), failed };
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

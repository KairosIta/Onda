import type { SourceId, Track } from '@/types/track';

/**
 * Regole di composizione della federazione, separate dal registro delle
 * sorgenti per lo stesso motivo per cui `librarySchema` e' separato da
 * `library`: qui non si tocca ne' la rete ne' i moduli nativi, quindi la
 * parte che decide cosa vede l'utente e' verificabile da sola.
 */

export interface FederatedResult {
  tracks: Track[];
  /** Sorgenti che hanno fallito: l'app resta usabile, ma lo diciamo. */
  failed: { source: SourceId; message: string }[];
}

/** Esito di una singola sorgente interrogata dalla federazione. */
export interface SourceOutcome {
  source: SourceId;
  result: PromiseSettledResult<Track[]>;
}

/**
 * Alterna i risultati delle sorgenti invece di concatenarli: senza questo
 * la prima schermata sarebbe tutta Audius e Jamendo non si vedrebbe mai.
 */
export function interleave(lists: Track[][]): Track[] {
  const out: Track[] = [];
  const max = Math.max(0, ...lists.map((l) => l.length));
  for (let i = 0; i < max; i++) {
    for (const list of lists) {
      if (list[i]) out.push(list[i]);
    }
  }
  return out;
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

export function describeFailure(reason: unknown): string {
  const message = reason instanceof Error ? reason.message : String(reason ?? '');
  if (!message) return 'errore sconosciuto';
  return NETWORK.test(message) ? 'rete non raggiungibile' : message;
}

/**
 * Compone gli esiti in un unico risultato.
 *
 * Nessuna sorgente ha risposto: e' un errore, e va propagato come tale.
 *
 * Tornando `{ tracks: [], failed }` sarebbe indistinguibile da un catalogo
 * finito, e chi pagina legge la pagina vuota come "fine elenco": lo scroll
 * infinito si chiuderebbe per sempre su una caduta di rete di un secondo.
 * E' lo stesso equivoco delle liste vuote di Jamendo, un piano piu' in alto.
 */
export function combine(outcomes: SourceOutcome[]): FederatedResult {
  const lists: Track[][] = [];
  const failed: FederatedResult['failed'] = [];

  for (const { source, result } of outcomes) {
    if (result.status === 'fulfilled') lists.push(result.value);
    else failed.push({ source, message: describeFailure(result.reason) });
  }

  if (lists.length === 0 && outcomes.length > 0) {
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

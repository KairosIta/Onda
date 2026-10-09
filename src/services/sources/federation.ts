import type { SourceId, Track } from '@/types/track';

/**
 * Regole di composizione della federazione, separate dal registro delle
 * sorgenti per lo stesso motivo per cui `librarySchema` e' separato da
 * `library`: qui non si tocca ne' la rete ne' i moduli nativi, quindi la
 * parte che decide cosa vede l'utente e' verificabile da sola.
 */

/**
 * Generico sul tipo di elemento: nasce per le tracce, ma artisti e album
 * cercati per nome si compongono con la stessa regola.
 */
export interface FederatedResult<T = Track> {
  tracks: T[];
  /** Sorgenti che hanno fallito: l'app resta usabile, ma lo diciamo. */
  failed: { source: SourceId; message: string }[];
}

/** Esito di una singola sorgente interrogata dalla federazione. */
export interface SourceOutcome<T = Track> {
  source: SourceId;
  result: PromiseSettledResult<T[]>;
}

/**
 * Alterna i risultati delle sorgenti invece di concatenarli: senza questo
 * la prima schermata sarebbe tutta Audius e Jamendo non si vedrebbe mai.
 */
export function interleave<T>(lists: T[][]): T[] {
  const out: T[] = [];
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
export function combine<T>(outcomes: SourceOutcome<T>[]): FederatedResult<T> {
  const lists: T[][] = [];
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

// --- paginazione ------------------------------------------------------

/**
 * Da dove riprende ogni sorgente di un elenco a scorrimento. Una sorgente
 * che non compare ha finito i suoi brani e non si interroga piu'.
 *
 * Prima l'offset era uno solo per tutte, e una pagina con una sorgente
 * caduta lo teneva fermo per tutte. Per un guasto di un secondo andava
 * bene; con Jamendo giu' per ore — quota finita, Client ID sbagliato —
 * ogni scroll richiedeva ad Audius la stessa pagina, il dedup la scartava
 * e l'elenco restava fermo ai primi venti brani per sempre.
 *
 * Con un offset per sorgente chi risponde va avanti, chi e' caduta
 * richiede la stessa pagina alla volta dopo e, quando torna, riparte da
 * dove era rimasta: niente buchi e niente doppioni.
 */
export type SourceCursor = Partial<Record<SourceId, number>>;

/** Una pagina federata e il cursore della successiva; senza, l'elenco e' finito. */
export interface FederatedPage<T = Track> extends FederatedResult<T> {
  next?: SourceCursor;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isOffset = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0;

/**
 * Il cursore da cui parte una pagina. La prima pagina non ne ha uno, e
 * qualunque cosa non sia un cursore vale come prima pagina: tutte le
 * sorgenti da zero. Una sorgente spenta nel frattempo non si interroga.
 */
export function resolveCursor(param: unknown, sources: readonly SourceId[]): SourceCursor {
  if (!isRecord(param)) return Object.fromEntries(sources.map((s) => [s, 0]));

  const cursor: SourceCursor = {};
  for (const source of sources) {
    const offset = param[source];
    if (isOffset(offset)) cursor[source] = offset;
  }
  return cursor;
}

/**
 * Il cursore della pagina dopo, dagli esiti di questa:
 *
 * - brani arrivati: la sorgente avanza di una pagina;
 * - sorgente caduta: resta dov'era e riprova alla prossima;
 * - zero brani senza errore: la sorgente ha finito e si toglie.
 *
 * Quando non resta nessuna sorgente l'elenco e' finito (`undefined`).
 *
 * Zero brani vale come fine anche se la sorgente ha scartato una pagina
 * intera di brani non riproducibili: e' la regola che il cursore unico
 * applicava a tutte insieme, ora presa sorgente per sorgente. Le risposte
 * vuote per errore di Jamendo le esclude gia' l'adapter, che ritenta
 * prima di arrendersi.
 */
export function advanceCursor<T>(
  cursor: SourceCursor,
  outcomes: readonly SourceOutcome<T>[],
  pageSize: number,
): SourceCursor | undefined {
  const next: SourceCursor = {};
  for (const { source, result } of outcomes) {
    const offset = cursor[source];
    if (offset === undefined) continue;
    if (result.status === 'rejected') next[source] = offset;
    else if (result.value.length > 0) next[source] = offset + pageSize;
  }
  return Object.keys(next).length > 0 ? next : undefined;
}

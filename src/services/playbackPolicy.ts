import type { PlaybackErrorCode } from '@/player';

/**
 * Regole di reazione agli errori di riproduzione, separate dai listener
 * per lo stesso motivo di `federation` e `librarySchema`: qui non si tocca
 * il modulo nativo, quindi la regola che decide se la coda va avanti o si
 * ferma si verifica senza un dispositivo. Provocare a comando un brano
 * illeggibile su un catalogo remoto non e' possibile.
 */

/**
 * Quanti brani illeggibili di fila si possono saltare prima di fermarsi.
 *
 * E' un budget di fallimenti *consecutivi*: appena qualcosa suona davvero
 * torna pieno (vedi budgetAfterPlayingChange). Senza quella ricarica
 * sarebbe un budget per processo, e dopo tre salti sparsi in una giornata
 * di ascolto la coda si bloccherebbe al primo brano rotto successivo.
 */
export const MAX_SOURCE_SKIPS = 3;

export type SkipDecision =
  /** Errore recuperabile: non si salta e non si consuma budget. */
  | 'ignora'
  /** Brano illeggibile: si prova a passare al successivo. */
  | 'salta'
  /** Budget esaurito: si resta fermi. */
  | 'fermati';

export interface SkipContext {
  code: PlaybackErrorCode;
  /** Salti gia' consumati dall'ultima riproduzione riuscita. */
  skipsUsed: number;
}

/**
 * Qui si decide solo se vale la pena provare. Se un brano successivo esista
 * lo sa soltanto il player: con lo shuffle segue il suo ordine e con «ripeti
 * tutto» torna al primo, quindi l'indice lineare della coda mentiva in
 * entrambi i casi e fermava la coda con un brano ancora da suonare.
 * `skipToNextAfterError` da' il verdetto sul main thread, e un salto non
 * eseguito non consuma budget.
 */
export function decideSkip({ code, skipsUsed }: SkipContext): SkipDecision {
  // Una caduta di rete e' recuperabile: non deve divorare la coda.
  if (code === 'network') return 'ignora';
  return skipsUsed >= MAX_SOURCE_SKIPS ? 'fermati' : 'salta';
}

/**
 * L'audio sta effettivamente uscendo: la sorgente precedente e' stata
 * superata e il budget di salti torna pieno.
 *
 * Va legato a questo evento e non alla transizione di traccia: la
 * transizione scatta anche per il salto che facciamo noi, quindi azzerare
 * il budget li' lo renderebbe infinito e una coda tutta rotta verrebbe
 * percorsa fino in fondo. Un brano illeggibile non arriva mai a `playing`.
 */
export function budgetAfterPlayingChange(playing: boolean, skipsUsed: number): number {
  return playing ? 0 : skipsUsed;
}

/**
 * Un errore di rete non consuma la coda ma non lascia nemmeno il player
 * fermo ad aspettare un dito: si riprova da soli, a distanze crescenti,
 * per il tempo di un tunnel o di un cambio di cella. Esaurite le attese
 * resta l'avviso con Riprova.
 */
export const NETWORK_RETRY_DELAYS_MS: readonly number[] = [2000, 5000, 10000];

/** Attesa prima del tentativo numero `attempt` (da 0), o `null` se basta così. */
export function networkRetryDelay(attempt: number): number | null {
  return NETWORK_RETRY_DELAYS_MS[attempt] ?? null;
}

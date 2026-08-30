import type { PlaybackErrorCode } from '@rntp/player';

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
  /** Brano illeggibile: si passa al successivo. */
  | 'salta'
  /** Budget esaurito, posizione ignota o fine coda: si resta fermi. */
  | 'fermati';

export interface SkipContext {
  code: PlaybackErrorCode;
  /** Salti gia' consumati dall'ultima riproduzione riuscita. */
  skipsUsed: number;
  /**
   * Letta pigramente: su un errore di rete il modulo nativo non va
   * interrogato affatto, ed e' l'ordine che aveva il gestore prima che
   * questa regola fosse estratta.
   */
  queue: () => { index: number | null; length: number };
}

export function decideSkip({ code, skipsUsed, queue }: SkipContext): SkipDecision {
  // Una caduta di rete e' recuperabile: non deve divorare la coda.
  if (code === 'network' || code === 'play-not-permitted') return 'ignora';
  if (skipsUsed >= MAX_SOURCE_SKIPS) return 'fermati';

  const { index, length } = queue();
  if (index === null || index >= length - 1) return 'fermati';
  return 'salta';
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

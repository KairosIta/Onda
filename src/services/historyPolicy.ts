/**
 * Quando un brano conta come «ascoltato». La cronologia si aggiornava al
 * cambio di media item, cioè anche per un brano saltato dopo un secondo:
 * «Ascoltati di recente» finiva pieno di brani mai sentiti.
 *
 * Il tick nativo di progresso arriva ogni cinque secondi in riproduzione
 * (`progressSync` in setupPlayer), quindi la soglia si supera al più cinque
 * secondi dopo l'istante esatto: per una cronologia va benissimo.
 */

/** Trenta secondi: la stessa soglia che usano i servizi di streaming. */
export const LISTEN_THRESHOLD_SEC = 30;

/**
 * Un brano più corto di un minuto conta a metà: una jingle da venti
 * secondi non arriverebbe mai a trenta.
 */
export function listenThreshold(durationSec: number): number {
  if (!Number.isFinite(durationSec) || durationSec <= 0) return LISTEN_THRESHOLD_SEC;
  return Math.min(LISTEN_THRESHOLD_SEC, durationSec / 2);
}

export function reachedListen(positionSec: number, durationSec: number): boolean {
  return Number.isFinite(positionSec) && positionSec >= listenThreshold(durationSec);
}

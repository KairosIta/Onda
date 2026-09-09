import { useSyncExternalStore } from 'react';

/**
 * Il brano corrente e' morto e il player e' fermo. Su Android RNTP non
 * emette mai lo stato `error`: dopo un errore ExoPlayer torna `idle`, che
 * per la tabella del tasto play e' una pausa qualunque. Senza questo flag
 * l'avviso con Riprova non compare mai e il tasto play, che chiama solo
 * `play()` senza ripreparare la sorgente, non fa niente.
 *
 * Lo alza `playbackService` quando decide di non saltare; lo abbassa il
 * primo segnale di vita del player (caricamento, cambio brano).
 */

let fault = false;
const listeners = new Set<() => void>();

function set(next: boolean): void {
  if (fault === next) return;
  fault = next;
  listeners.forEach((l) => l());
}

export const markPlaybackFault = (): void => set(true);
export const clearPlaybackFault = (): void => set(false);
export const hasPlaybackFault = (): boolean => fault;

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function usePlaybackFault(): boolean {
  return useSyncExternalStore(subscribe, hasPlaybackFault, hasPlaybackFault);
}

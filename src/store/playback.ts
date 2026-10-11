import { useSyncExternalStore } from 'react';
import { player, type RepeatMode } from '@/player';
import { readJSON, writeJSON } from '@/services/storage';
import { loadPlaybackPrefs, type PlaybackPrefs } from './playbackSchema';

/**
 * Preferenze di riproduzione, separate dalla libreria perche' cambiano
 * spesso e non hanno niente a che vedere con quello che l'utente salva.
 *
 * Shuffle e repeat sono entrambi stati del player nativo e vanno
 * risincronizzati a ogni cambio (vedi applyRepeat).
 *
 * Attenzione: lo shuffle nativo non riordina la coda, tiene a parte una
 * permutazione privata. La coda e l'indice attivo restano quelli di
 * partenza, quindi la schermata Coda deve dichiarare che l'elenco non e'
 * l'ordine di ascolto — vedi `describeQueue`.
 */

const KEY = 'playback.v1';

let state: PlaybackPrefs = loadPlaybackPrefs(readJSON(KEY));

const listeners = new Set<() => void>();

function commit(next: PlaybackPrefs): void {
  state = next;
  writeJSON(KEY, state);
  listeners.forEach((l) => l());
}

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export function usePlaybackPrefs(): PlaybackPrefs {
  return useSyncExternalStore(subscribe, () => state);
}

export const getShuffle = (): boolean => state.shuffle;
export const getRepeat = (): RepeatMode => state.repeat;

export function toggleShuffle(): void {
  const next = { ...state, shuffle: !state.shuffle };
  commit(next);
  player.setShuffleModeEnabled(next.shuffle);
}

/** Ciclo Coda -> Traccia -> Nessuna ripetizione. */
export function cycleRepeat(): RepeatMode {
  const order: RepeatMode[] = ['all', 'one', 'off'];
  const next = order[(order.indexOf(state.repeat) + 1) % order.length];
  commit({ ...state, repeat: next });
  player.setRepeatMode(next);
  return next;
}

/** Riallinea il player alla preferenza salvata: da chiamare dopo setupPlayer. */
export function applyRepeat(): void {
  try {
    player.setRepeatMode(state.repeat);
    player.setShuffleModeEnabled(state.shuffle);
  } catch {
    // Player non ancora pronto: la preferenza resta salvata e si
    // riapplica al prossimo avvio.
  }
}

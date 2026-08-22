import { useSyncExternalStore } from 'react';
import TrackPlayer from '@rntp/player';

/**
 * Timer di spegnimento. Non persistito: un timer sopravvissuto al
 * riavvio dell'app metterebbe in pausa la musica senza che nessuno
 * capisca perche'.
 *
 * "Fine traccia" non e' un timer a tempo: si arma sull'evento di fine
 * coda ed e' gestito in player.tsx dove il progresso e' gia' a portata.
 */

let endsAt: number | null = null;
let handle: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((l) => l());
}

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** Timestamp di spegnimento, o null se il timer non e' armato. */
export function useSleepTimer(): number | null {
  return useSyncExternalStore(subscribe, () => endsAt);
}

export function startSleepTimer(minutes: number): void {
  cancelSleepTimer();
  endsAt = Date.now() + minutes * 60_000;
  TrackPlayer.sleepAfterTime(minutes * 60);
  handle = setTimeout(() => {
    endsAt = null;
    handle = null;
    notify();
  }, minutes * 60_000);
  notify();
}

export function cancelSleepTimer(): void {
  if (handle) clearTimeout(handle);
  TrackPlayer.cancelSleepTimer();
  handle = null;
  endsAt = null;
  notify();
}

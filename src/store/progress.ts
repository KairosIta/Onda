import { useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import TrackPlayer, { Event, type Progress } from '@rntp/player';
import { progressPollInterval } from '@/services/progressPolicy';

/**
 * L'unico osservatore di progresso dell'app. `useProgress` di RNTP apre un
 * timer per ogni componente che lo chiama: con il mini-player nella tab
 * bar, un secondo dentro `Screen` e il player aperto erano tre letture del
 * bridge ogni mezzo secondo, anche in pausa e con l'app in background.
 *
 * Qui il timer e' uno, parte solo se qualcuno legge, va a mezzo secondo in
 * riproduzione e a due secondi in pausa (la regola sta in
 * `progressPolicy`), e si ferma senza brano o con l'app dietro le quinte.
 */

const EMPTY: Progress = { position: 0, duration: 0, buffered: 0, cached: 0 };

let snapshot: Progress = EMPTY;
/**
 * Progresso "finto" della coda in attesa: il player nativo non ha ancora
 * il brano, ma slider e barra devono mostrare da dove si riprendera'.
 */
let override: Progress | null = null;

let timer: ReturnType<typeof setInterval> | null = null;
let intervalMs: number | null = null;
let playing = false;
let hasTrack = false;
let appActive = true;
let started = false;

const listeners = new Set<() => void>();
const notify = (): void => listeners.forEach((l) => l());

const same = (a: Progress, b: Progress): boolean =>
  a.position === b.position && a.duration === b.duration && a.buffered === b.buffered;

function tick(): void {
  if (override) return;
  let next = TrackPlayer.getProgress();
  // Finche' lo stream non e' preparato ExoPlayer non conosce la durata e
  // ne riporta zero: slider e barra collasserebbero per un secondo a ogni
  // brano ripreso a meta'. La durata dichiarata dalla sorgente basta.
  if (next.duration <= 0) {
    const declared = TrackPlayer.getActiveMediaItem()?.duration;
    if (declared && declared > 0) next = { ...next, duration: declared };
  }
  // Stesso riferimento se niente e' cambiato: useSyncExternalStore
  // confronta per identita', e un oggetto nuovo a ogni tick ridisegnerebbe
  // slider e tempi anche in pausa.
  if (same(next, snapshot)) return;
  snapshot = next;
  notify();
}

function reschedule(): void {
  const wanted = progressPollInterval({
    subscribers: listeners.size,
    hasTrack: hasTrack && !override,
    appActive,
    playing,
  });
  if (wanted === intervalMs) return;
  if (timer) clearInterval(timer);
  timer = wanted === null ? null : setInterval(tick, wanted);
  intervalMs = wanted;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  // Il primo lettore trova un valore fresco, non quello di quando l'ultimo
  // se n'era andato.
  if (listeners.size === 1) tick();
  reschedule();
  return () => {
    listeners.delete(listener);
    reschedule();
  };
}

const getSnapshot = (): Progress => override ?? snapshot;

/** Posizione, durata e porzione bufferizzata del brano attivo, in secondi. */
export function useProgress(): Progress {
  return useSyncExternalStore(subscribe, getSnapshot);
}

/**
 * Sostituisce le letture dal player con un valore fisso, o le riattiva
 * con `null`. Serve alla coda in attesa; all'uscita il valore fisso resta
 * come ultima istantanea, cosi' la barra non torna a zero nel frame che
 * passa fra il caricamento della coda e la prima lettura vera.
 */
export function setProgressOverride(next: Progress | null): void {
  if (override && !next) snapshot = override;
  override = next;
  notify();
  reschedule();
}

function syncFromPlayer(): void {
  playing = TrackPlayer.isPlaying();
  hasTrack = TrackPlayer.getActiveMediaItemIndex() !== null;
}

/** Da chiamare una volta, dopo setupPlayer: prima il player non risponde. */
export function startProgressObserver(): void {
  if (started) return;
  started = true;

  syncFromPlayer();
  appActive = AppState.currentState !== 'background';

  TrackPlayer.addEventListener(Event.IsPlayingChanged, ({ playing: next }) => {
    playing = next;
    tick();
    reschedule();
  });
  TrackPlayer.addEventListener(Event.MediaItemTransition, ({ item }) => {
    hasTrack = item !== null;
    tick();
    reschedule();
  });
  // In background gli eventi vanno al gestore headless, non qui: al
  // ritorno si rilegge tutto dal player invece di fidarsi dell'ultimo
  // valore visto.
  AppState.addEventListener('change', (status) => {
    appActive = status === 'active';
    if (appActive) {
      syncFromPlayer();
      tick();
    }
    reschedule();
  });
  reschedule();
}

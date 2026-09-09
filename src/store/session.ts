import { useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import TrackPlayer, { Event, type MediaItem } from '@rntp/player';
import { toMediaItem, trackFromMediaItem } from '@/services/mediaItems';
import { readJSON, writeJSON } from '@/services/storage';
import type { Track } from '@/types/track';
import { remember } from './library';
import { setProgressOverride } from './progress';
import { loadSavedPosition, loadSavedQueue, resumePosition, windowQueue } from './sessionSchema';

/**
 * Sessione di ascolto: la coda e la posizione sopravvivono alla chiusura
 * dell'app. Prima Onda ripartiva sempre vuota, e "riprendi da dove eri"
 * era una promessa della schermata Scopri che nessuno manteneva.
 *
 * La coda vera resta dentro RNTP (vedi `queue.tsx`): questo store la
 * fotografa su disco quando cambia e la tiene *in attesa* all'avvio, senza
 * caricarla nel player. Caricarla subito vorrebbe dire aprire lo stream e
 * far comparire la notifica in pausa prima che l'utente abbia toccato
 * niente. Cosi' invece mini-player e player mostrano il brano da disco, e
 * il player nativo lo riceve al primo play, skip o apertura della Coda.
 *
 * Lo store tiene anche il brano attivo del player, al posto di
 * `useActiveMediaItem` di RNTP: "brano attivo" e "coda in attesa" devono
 * cambiare insieme, in un solo snapshot. Con due store separati, nel tick
 * fra la consegna della coda e l'evento del player nessuno dei due avrebbe
 * un brano, il mini-player sparirebbe e il player si chiuderebbe da solo.
 */

const QUEUE_KEY = 'session.queue.v1';
const POSITION_KEY = 'session.position.v1';

interface PendingSession {
  tracks: Track[];
  index: number;
  /** Secondi da cui ripartira' il brano attivo. */
  position: number;
  /** Il brano attivo gia' nella forma che le schermate si aspettano. */
  item: MediaItem;
  /**
   * Consegnata al player ma non ancora confermata da lui: fino al primo
   * `MediaItemTransition` le schermate continuano a mostrare il brano da
   * qui, ma i comandi vanno gia' al player.
   */
  loading: boolean;
}

export interface NowPlaying {
  item: MediaItem | null;
  /**
   * Il brano viene dalla coda ripristinata e il player nativo non lo ha
   * ancora ricevuto: i comandi vanno prima da `activateSession`. Mentre
   * la consegna e' in corso vale gia' `false`.
   */
  pending: boolean;
}

const NOTHING: NowPlaying = { item: null, pending: false };

let active: MediaItem | null = null;
let pending: PendingSession | null = null;
let snapshot: NowPlaying = NOTHING;
let started = false;
const listeners = new Set<() => void>();

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** Un solo snapshot per entrambi i segnali; identita' stabile se non cambia niente. */
function publish(): void {
  const next: NowPlaying = active
    ? { item: active, pending: false }
    : pending
      ? { item: pending.item, pending: !pending.loading }
      : NOTHING;
  if (next.item !== snapshot.item || next.pending !== snapshot.pending) snapshot = next;
  listeners.forEach((l) => l());
}

function setPending(next: PendingSession | null): void {
  pending = next;
  const track = next?.tracks[next.index];
  setProgressOverride(
    next && track
      ? { position: next.position, duration: track.durationSec, buffered: 0, cached: 0 }
      : null,
  );
  publish();
}

function setActive(next: MediaItem | null): void {
  active = next;
  // Un brano nel player mentre c'era una coda in attesa: e' la conferma
  // della consegna, oppure il controller connesso in ritardo con il suo
  // brano. In entrambi i casi da qui in poi comanda il player.
  if (next && pending) setPending(null);
  else publish();
}

/**
 * Il brano da mostrare come "in riproduzione": quello del player nativo,
 * oppure quello della coda in attesa dopo un riavvio. Le schermate usano
 * questo e non `useActiveMediaItem`, altrimenti all'avvio non avrebbero
 * niente da mostrare finche' l'utente non preme play.
 */
export function useNowPlaying(): NowPlaying {
  return useSyncExternalStore(subscribe, () => snapshot);
}

// --- salvataggio -----------------------------------------------------

/**
 * Fotografa la coda di RNTP. Chiamata a ogni transizione e cambio coda,
 * dal processo UI e dal gestore headless: MMKV e' lo stesso file.
 *
 * Una coda vuota non cancella il salvataggio: RNTP la svuota anche quando
 * il servizio viene fermato togliendo l'app dai recenti, ed e' proprio
 * quella la sessione da riprendere all'avvio dopo.
 */
export function saveQueueSnapshot(): void {
  const items = TrackPlayer.getQueue();
  const activeIndex = TrackPlayer.getActiveMediaItemIndex();
  if (items.length === 0 || activeIndex === null) return;

  const tracks: Track[] = [];
  let index = -1;
  items.forEach((item, i) => {
    const track = trackFromMediaItem(item);
    if (!track) return;
    if (i === activeIndex) index = tracks.length;
    tracks.push(track);
  });
  if (index < 0) return;

  writeJSON(QUEUE_KEY, { ...windowQueue(tracks, index), savedAt: Date.now() });
}

/**
 * La posizione arriva dal timer nativo di RNTP (`progressSync` in
 * setupPlayer): ogni cinque secondi in riproduzione e un ultimo colpo alla
 * pausa, a schermo spento compreso. Niente timer JS da tenere vivi.
 */
export function savePosition(uid: string, position: number): void {
  if (!uid || !Number.isFinite(position)) return;
  writeJSON(POSITION_KEY, { uid, position, savedAt: Date.now() });
}

// --- ripristino ------------------------------------------------------

/**
 * All'avvio: se il player e' vuoto e c'e' una coda salvata, la mette in
 * attesa. Con il servizio ancora vivo (ricarica del solo JS) il player ha
 * gia' il suo brano e non c'e' niente da riprendere.
 */
export function restoreSession(): void {
  if (active) return;

  const queue = loadSavedQueue(readJSON(QUEUE_KEY), Date.now());
  if (!queue) return;
  const track = queue.tracks[queue.index];
  if (!track) return;

  // Serve al cuoricino e alla cronologia: risolvono l'uid dal catalogo
  // volatile, che a processo appena nato e' vuoto.
  remember(queue.tracks);
  setPending({
    tracks: queue.tracks,
    index: queue.index,
    position: resumePosition(queue, loadSavedPosition(readJSON(POSITION_KEY))),
    item: toMediaItem(track),
    loading: false,
  });
}

/**
 * Carica la coda in attesa nel player, ripartendo dalla posizione salvata.
 * Ritorna `true` se c'era qualcosa da caricare: chi chiama sa cosi' se il
 * comando che voleva dare (play, skip) e' gia' stato assorbito o meno.
 */
export function activateSession({ play }: { play: boolean }): boolean {
  if (!pending) return false;
  const { tracks, index, position } = pending;

  // Gia' consegnata: i comandi al controller sono in ordine, quindi un
  // play accodato adesso parte appena il brano e' pronto.
  if (pending.loading) {
    if (play) TrackPlayer.play();
    return true;
  }

  // Il player ha gia' un brano: la coda in attesa era un residuo (il
  // controller nativo si connette dopo setupPlayer) e va solo dimenticata.
  const live = TrackPlayer.getActiveMediaItem();
  if (live) {
    setActive(live);
    return false;
  }

  setPending({ ...pending, loading: true });
  TrackPlayer.setMediaItems(tracks.map(toMediaItem), index);
  // Il seek si applica al brano appena preparato, prima di un eventuale
  // play; il controller li esegue nell'ordine in cui arrivano.
  if (position > 0) TrackPlayer.seekTo(position);
  if (play) TrackPlayer.play();
  return true;
}

/** Lo slider mosso prima del primo play: si ricorda solo da dove ripartire. */
export function seekPending(position: number): void {
  if (!pending || pending.loading) return;
  savePosition(pending.item.mediaId ?? '', position);
  setPending({ ...pending, position });
}

/** La coda in attesa per chi deve mostrarla senza caricarla (la riga "Prossimo"). */
export function getPendingQueue(): { tracks: Track[]; index: number } | null {
  return pending ? { tracks: pending.tracks, index: pending.index } : null;
}

/** Una coda nuova sostituisce quella in attesa. */
export function clearPending(): void {
  if (pending) setPending(null);
}

// --- listener ---------------------------------------------------------

/** Da chiamare una volta dopo setupPlayer, prima di `restoreSession`. */
export function startSessionPersistence(): void {
  if (started) return;
  started = true;

  active = TrackPlayer.getActiveMediaItem();
  publish();

  TrackPlayer.addEventListener(Event.MediaItemTransition, ({ item }) => setActive(item));
  TrackPlayer.addEventListener(Event.MediaMetadataChanged, () => {
    setActive(TrackPlayer.getActiveMediaItem());
  });

  AppState.addEventListener('change', (status) => {
    if (status === 'active') {
      // In background gli eventi vanno al gestore headless, non qui: al
      // ritorno si rilegge il player invece di fidarsi dell'ultimo evento.
      setActive(TrackPlayer.getActiveMediaItem());
      return;
    }
    // Uscendo dall'app si salva subito la posizione: il timer nativo puo'
    // essere a meta' dei suoi cinque secondi, e se il sistema uccide il
    // processo poco dopo e' l'ultima parola che resta.
    const live = TrackPlayer.getActiveMediaItem();
    if (live?.mediaId) savePosition(live.mediaId, TrackPlayer.getProgress().position);
  });
}

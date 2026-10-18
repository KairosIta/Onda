import { useSyncExternalStore } from 'react';
import type {
  NativeMediaItem,
  NativeMediaItemInput,
  NativePlayerEvent,
  OndaPlayerFunctions,
} from '../../modules/onda-player';
import type { PlayerBackend } from './backend';
import type {
  MediaItem,
  PlaybackErrorCode,
  PlaybackState,
  PlayerEvent,
  PlayerEventName,
  PlayerEventOf,
} from './types';

/**
 * Il contratto del player (`backend.ts`) sopra il modulo nativo nostro su
 * Media3 (`modules/onda-player`). E' una fabbrica pura: il modulo nativo e
 * `AppState` arrivano da fuori (`media3.ts`), cosi' i test in Node la
 * provano con un modulo finto. Qui si traduce e si instradano gli eventi;
 * le regole di Onda stanno fuori.
 */

/** Quello che serve del modulo nativo. */
export type NativePlayer = OndaPlayerFunctions & {
  addListener(
    eventName: 'onPlayerEvent',
    listener: (event: NativePlayerEvent) => void,
  ): { remove(): void };
};

/** Quello che serve di `AppState` di React Native. */
export interface AppStateLike {
  readonly currentState: string | null;
}

/** Un gestore in background che non risponde non deve fermare gli eventi dopo di lui. */
export const BACKGROUND_EVENT_TIMEOUT_MS = 10_000;

const PLAYBACK_STATES: readonly PlaybackState[] = ['idle', 'ready', 'buffering', 'ended', 'error'];
const ERROR_CODES: readonly PlaybackErrorCode[] = ['network', 'source', 'renderer', 'unknown'];

type Listener = (event: PlayerEvent) => void;

/**
 * Stato del player e audio in uscita per gli hook delle schermate. Si
 * aggiornano a ogni evento, anche quando l'evento va al gestore in
 * background: tornando in primo piano gli hook sono gia' giusti.
 */
export function createPlaybackSignals(initial: { state: PlaybackState; playing: boolean }) {
  let state = initial.state;
  let playing = initial.playing;
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((l) => l());

  return {
    getState: () => state,
    getPlaying: () => playing,
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    apply(event: PlayerEvent): void {
      if (event.type === 'playbackStateChanged' && event.state !== state) {
        state = event.state;
        notify();
      } else if (event.type === 'isPlayingChanged' && event.playing !== playing) {
        playing = event.playing;
        notify();
      }
    },
  };
}

export function createMedia3Backend(native: NativePlayer, appState: AppStateLike): PlayerBackend {
  // --- elementi: identita' stabile ---------------------------------------

  /**
   * Il nativo restituisce copie: la chiave che viaggia con ogni elemento
   * riporta all'oggetto mandato, con i suoi `extras`. `store/session`
   * riconosce per identita' il brano attivo invariato.
   */
  const byKey = new Map<string, MediaItem>();
  const keyOf = new WeakMap<MediaItem, string>();
  let nextKey = 0;

  function toNative(item: MediaItem): NativeMediaItemInput {
    let key = keyOf.get(item);
    if (!key) {
      key = `k${++nextKey}`;
      keyOf.set(item, key);
    }
    byKey.set(key, item);
    return {
      key,
      mediaId: item.mediaId,
      url: item.url,
      title: item.title,
      artist: item.artist,
      artworkUrl: item.artworkUrl,
      duration: item.duration,
      extras: item.extras === undefined ? undefined : JSON.stringify(item.extras),
    };
  }

  /**
   * Un elemento che la cache non conosce (dopo una ricarica del JS, o messo
   * da Android Auto) si ricostruisce dai campi del nativo e da li' resta lo
   * stesso oggetto.
   */
  function fromNative(n: NativeMediaItem): MediaItem {
    const key = cacheKey(n);
    const cached = byKey.get(key);
    if (cached) return cached;
    const item: MediaItem = {
      mediaId: n.mediaId,
      url: n.url,
      title: n.title ?? undefined,
      artist: n.artist ?? undefined,
      artworkUrl: n.artworkUrl ?? undefined,
      duration: n.duration ?? undefined,
      extras: parseExtras(n.extras),
    };
    byKey.set(key, item);
    return item;
  }

  /** Tiene in cache solo gli elementi della coda di adesso. */
  function prune(queue: NativeMediaItem[]): void {
    const live = new Set(queue.map(cacheKey));
    for (const key of byKey.keys()) if (!live.has(key)) byKey.delete(key);
  }

  // --- eventi -----------------------------------------------------------

  const signals = createPlaybackSignals({
    state: native.getPlaybackState(),
    playing: native.isPlaying(),
  });
  const listeners = new Map<PlayerEventName, Set<Listener>>();
  let backgroundHandler: ((event: PlayerEvent) => Promise<void>) | null = null;
  let queueTail: Promise<void> = Promise.resolve();

  function toEvent(raw: NativePlayerEvent): PlayerEvent | null {
    switch (raw.type) {
      case 'isPlayingChanged':
        return { type: 'isPlayingChanged', playing: raw.playing === true };
      case 'playbackStateChanged': {
        const state = PLAYBACK_STATES.find((s) => s === raw.state) ?? 'idle';
        return { type: 'playbackStateChanged', state };
      }
      case 'mediaItemTransition': {
        const item = raw.item as NativeMediaItem | null;
        return { type: 'mediaItemTransition', item: item ? fromNative(item) : null };
      }
      case 'mediaMetadataChanged':
        return { type: 'mediaMetadataChanged' };
      case 'queueChanged':
        // Una lettura fresca, non il payload: vede anche i comandi dati dopo.
        prune(native.getQueue());
        return { type: 'queueChanged' };
      case 'playbackError': {
        const code = ERROR_CODES.find((c) => c === raw.code) ?? 'unknown';
        return { type: 'playbackError', code, message: String(raw.message ?? '') };
      }
      case 'progressUpdated':
        return {
          type: 'progressUpdated',
          mediaId: String(raw.mediaId ?? ''),
          position: Number(raw.position) || 0,
          duration: Number(raw.duration) || 0,
        };
      default:
        return null;
    }
  }

  /**
   * Ogni evento va una volta sola: ai listener se l'app e' in primo piano,
   * altrimenti al gestore in background. Gli stessi gestori stanno in
   * entrambi i posti (`playbackService`): consegnarlo due volte vorrebbe
   * dire, per esempio, saltare due brani per un errore.
   */
  async function deliver(event: PlayerEvent): Promise<void> {
    if (appState.currentState === 'active') {
      listeners.get(event.type)?.forEach((listener) => {
        try {
          listener(event);
        } catch (error) {
          console.error(`[player] listener di ${event.type}`, error);
        }
      });
      return;
    }
    if (!backgroundHandler) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<void>((resolve) => {
      timer = setTimeout(resolve, BACKGROUND_EVENT_TIMEOUT_MS);
    });
    try {
      await Promise.race([backgroundHandler(event), timeout]);
    } catch (error) {
      console.error(`[player] gestore in background su ${event.type}`, error);
    } finally {
      clearTimeout(timer);
    }
  }

  // Si ascolta dal primo import (`index.js`, prima di setup): Expo perde
  // gli eventi che arrivano quando nessuno ascolta.
  native.addListener('onPlayerEvent', (raw) => {
    const event = toEvent(raw);
    if (!event) return;
    signals.apply(event);
    // In fila: un evento non scavalca il gestore in background ancora al
    // lavoro su quello prima.
    queueTail = queueTail.then(() => deliver(event));
  });

  return {
    setup({ progressIntervalSeconds, commands }) {
      native.setup(progressIntervalSeconds, [...commands]);
    },

    registerBackgroundHandler(handler) {
      backgroundHandler = handler;
    },

    subscribe<K extends PlayerEventName>(name: K, listener: (event: PlayerEventOf<K>) => void) {
      const set = listeners.get(name) ?? new Set<Listener>();
      listeners.set(name, set);
      // L'evento che arriva per `name` e' sempre un PlayerEventOf<K>.
      const wrapped = listener as Listener;
      set.add(wrapped);
      return () => {
        set.delete(wrapped);
      };
    },

    play: () => native.play(),
    pause: () => native.pause(),
    seekTo: (seconds) => native.seekTo(seconds),
    skipToNext: () => native.skipToNext(),
    skipToNextAfterError: () => native.skipToNextAfterError(),
    skipToPrevious: () => native.skipToPrevious(),
    skipToIndex: (index) => native.skipToIndex(index),
    retry: () => native.retry(),
    scheduleRetry: (seconds) => native.scheduleRetry(seconds),
    cancelRetry: () => native.cancelRetry(),

    setMediaItems: (items, startIndex) => native.setMediaItems(items.map(toNative), startIndex),
    addMediaItem: (item) => native.addMediaItem(toNative(item)),
    insertMediaItem: (index, item) => native.insertMediaItems(index, [toNative(item)]),
    insertMediaItems: (index, items) => native.insertMediaItems(index, items.map(toNative)),
    removeMediaItem: (index) => native.removeMediaItems(index, index + 1),
    removeMediaItems: (from, to) => native.removeMediaItems(from, to),
    moveMediaItem: (from, to) => native.moveMediaItem(from, to),

    getQueue: () => native.getQueue().map(fromNative),
    getActiveMediaItem: () => {
      const item = native.getActiveMediaItem();
      return item && fromNative(item);
    },
    getActiveIndex: () => native.getActiveIndex(),
    getProgress: () => {
      const { position, duration, buffered } = native.getProgress();
      return { position, duration, buffered };
    },
    isPlaying: () => native.isPlaying(),

    setRepeatMode: (mode) => native.setRepeatMode(mode),
    setShuffleModeEnabled: (enabled) => native.setShuffleModeEnabled(enabled),

    sleepAfter: (seconds) => native.sleepAfter(seconds),
    cancelSleep: () => native.cancelSleep(),

    setBrowseTree: (categories) => native.setBrowseTree(JSON.stringify(categories)),

    usePlaybackState: () => useSyncExternalStore(signals.subscribe, signals.getState),
    useIsPlaying: () => useSyncExternalStore(signals.subscribe, signals.getPlaying),
  };
}

/** Un elemento senza chiave non viene dal JS: lo si riconosce da id e stream. */
function cacheKey(n: NativeMediaItem): string {
  return n.key ?? `native:${n.mediaId}:${n.url}`;
}

function parseExtras(json: string | null): Record<string, unknown> | undefined {
  if (!json) return undefined;
  try {
    const value: unknown = JSON.parse(json);
    return value && typeof value === 'object' ? (value as Record<string, unknown>) : undefined;
  } catch {
    return undefined;
  }
}

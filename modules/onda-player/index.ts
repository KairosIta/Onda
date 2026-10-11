import { NativeModule, requireNativeModule } from 'expo';

/**
 * Il modulo nativo del player di Onda, su AndroidX Media3
 * (`android/src/main/java/com/onda/playback`). L'app non lo usa
 * direttamente: passa dalla facciata `@/player`, che ne fa il contratto
 * (`src/player/backend.ts`).
 *
 * Le funzioni sono sincrone. I comandi tornano subito e il nativo li esegue
 * in ordine; le letture vedono gia' i comandi dati prima. Tempi in secondi.
 */

/** Un elemento come lo manda il JS. */
export interface NativeMediaItemInput {
  /** La chiave con cui il JS ritrova il suo oggetto quando l'elemento torna indietro. */
  key: string;
  mediaId: string;
  url: string;
  title?: string;
  artist?: string;
  artworkUrl?: string;
  duration?: number;
  /** Gli `extras` del contratto, come JSON: restano nel processo, intatti. */
  extras?: string;
}

/** Un elemento come lo restituisce il nativo; `key` manca se non viene dal JS (Android Auto). */
export interface NativeMediaItem {
  key: string | null;
  mediaId: string;
  url: string;
  title: string | null;
  artist: string | null;
  artworkUrl: string | null;
  duration: number | null;
  extras: string | null;
}

/** Un evento del player: `type` e i campi di `PlayerEvents` del contratto. */
export interface NativePlayerEvent {
  type: string;
  [field: string]: unknown;
}

type OndaPlayerEvents = {
  onPlayerEvent(event: NativePlayerEvent): void;
};

/** Le funzioni del modulo; gli eventi arrivano da `addListener('onPlayerEvent', …)`. */
export interface OndaPlayerFunctions {
  setup(progressIntervalSeconds: number, commands: string[]): void;

  play(): void;
  pause(): void;
  seekTo(seconds: number): void;
  skipToNext(): void;
  skipToPrevious(): void;
  skipToIndex(index: number): void;
  retry(): void;
  scheduleRetry(seconds: number): void;
  cancelRetry(): void;

  setMediaItems(items: NativeMediaItemInput[], startIndex: number): void;
  addMediaItem(item: NativeMediaItemInput): void;
  insertMediaItems(index: number, items: NativeMediaItemInput[]): void;
  removeMediaItems(from: number, to: number): void;
  moveMediaItem(from: number, to: number): void;

  getQueue(): NativeMediaItem[];
  getActiveIndex(): number | null;
  getActiveMediaItem(): NativeMediaItem | null;
  getProgress(): { position: number; duration: number; buffered: number };
  /** Questi due valgono come li ha annunciati l'ultimo evento, senza aspettare il main thread. */
  isPlaying(): boolean;
  getPlaybackState(): 'idle' | 'ready' | 'buffering' | 'ended';

  setRepeatMode(mode: 'off' | 'one' | 'all'): void;
  setShuffleModeEnabled(enabled: boolean): void;

  sleepAfter(seconds: number): void;
  cancelSleep(): void;

  /** Le categorie di Android Auto, come JSON. */
  setBrowseTree(json: string): void;
}

declare class OndaPlayerEmitter extends NativeModule<OndaPlayerEvents> {}

export type OndaPlayerModule = OndaPlayerEmitter & OndaPlayerFunctions;

export default requireNativeModule<OndaPlayerModule>('OndaPlayer');

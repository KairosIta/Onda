import type { PlayerBackend } from '@/player/backend';
import type {
  MediaItem,
  PlaybackState,
  PlayerEvent,
  PlayerEventName,
  RepeatMode,
} from '@/player/types';

/**
 * Il player finto dei test in Node, al posto dell'adattatore su RNTP (lo
 * sostituisce `test-doubles.mjs`). Segue il contratto di
 * `src/player/backend.ts` e la coda di Media3, cosi' le regole di Onda
 * sopra il player si provano senza telefono.
 *
 * I comandi cambiano lo stato subito, come promette il contratto. Gli
 * eventi che ne seguono (coda e brano cambiati) restano in attesa fino a
 * `fakePlayer.flush()`, perche' il nativo li manda dopo; quelli che
 * dipendono da rete e decoder (audio che esce, stato, errori, progresso)
 * li manda il test con `fakePlayer.emit()`, compreso `ended` a fine coda.
 *
 * Non prepara stream: la durata resta ignota, lo shuffle non riordina
 * niente e i timer (spegnimento, nuovo tentativo) si registrano e basta.
 */

type Listener = (event: PlayerEvent) => void;

interface Call {
  name: string;
  args: unknown[];
}

let queue: MediaItem[] = [];
let active: number | null = null;
let position = 0;
let playing = false;
let playbackState: PlaybackState = 'idle';
let repeat: RepeatMode = 'off';
let calls: Call[] = [];
const pending: PlayerEvent[] = [];
const listeners = new Map<PlayerEventName, Set<Listener>>();

const activeItem = (): MediaItem | null => (active === null ? null : (queue[active] ?? null));

function record(name: string, ...args: unknown[]): void {
  calls.push({ name, args });
}

function deliver(event: PlayerEvent): void {
  listeners.get(event.type)?.forEach((listener) => listener(event));
}

/** Il brano attivo e' cambiato: il nativo lo annuncia. */
function announceTransition(before: MediaItem | null): void {
  const after = activeItem();
  if (after !== before) pending.push({ type: 'mediaItemTransition', item: after });
}

/** Una modifica alla coda, con gli eventi che ne seguono. */
function editQueue(change: () => void): void {
  const before = activeItem();
  change();
  pending.push({ type: 'queueChanged' });
  announceTransition(before);
}

function jumpTo(index: number): void {
  const before = activeItem();
  active = index;
  position = 0;
  announceTransition(before);
}

function insert(index: number, items: MediaItem[]): void {
  editQueue(() => {
    queue.splice(index, 0, ...items);
    if (active === null) active = 0;
    else if (index <= active) active += items.length;
  });
}

function remove(from: number, to: number): void {
  editQueue(() => {
    queue.splice(from, to - from);
    if (active === null) return;
    if (active >= to) {
      active -= to - from;
    } else if (active >= from) {
      // Il contratto: tocca al primo che resta dopo quelli tolti; se dopo
      // non resta niente, al primo della coda, come in Media3.
      active = queue.length === 0 ? null : from < queue.length ? from : 0;
      position = 0;
    }
  });
}

export const backend: PlayerBackend = {
  setup(options) {
    record('setup', options);
  },
  registerBackgroundHandler() {
    record('registerBackgroundHandler');
  },
  subscribe(name, listener) {
    const set = listeners.get(name) ?? new Set<Listener>();
    listeners.set(name, set);
    set.add(listener as Listener);
    return () => {
      set.delete(listener as Listener);
    };
  },

  play: () => record('play'),
  pause: () => record('pause'),
  seekTo(seconds) {
    record('seekTo', seconds);
    position = seconds;
  },
  skipToNext() {
    record('skipToNext');
    if (active === null) return;
    if (active < queue.length - 1) jumpTo(active + 1);
    else if (repeat === 'all') jumpTo(0);
  },
  skipToPrevious() {
    record('skipToPrevious');
    if (active === null) return;
    if (position > 3) position = 0;
    else if (active > 0) jumpTo(active - 1);
    else if (repeat === 'all') jumpTo(queue.length - 1);
    else position = 0;
  },
  skipToIndex(index) {
    record('skipToIndex', index);
    if (index >= 0 && index < queue.length) jumpTo(index);
  },
  retry: () => record('retry'),
  scheduleRetry: (seconds) => record('scheduleRetry', seconds),
  cancelRetry: () => record('cancelRetry'),

  setMediaItems(items, startIndex) {
    record('setMediaItems', items, startIndex);
    queue = [...items];
    active = items.length > 0 ? startIndex : null;
    position = 0;
    pending.push({ type: 'queueChanged' }, { type: 'mediaItemTransition', item: activeItem() });
  },
  addMediaItem(item) {
    record('addMediaItem', item);
    insert(queue.length, [item]);
  },
  insertMediaItem(index, item) {
    record('insertMediaItem', index, item);
    insert(index, [item]);
  },
  insertMediaItems(index, items) {
    record('insertMediaItems', index, items);
    insert(index, items);
  },
  removeMediaItem(index) {
    record('removeMediaItem', index);
    remove(index, index + 1);
  },
  removeMediaItems(from, to) {
    record('removeMediaItems', from, to);
    remove(from, to);
  },
  moveMediaItem(from, to) {
    record('moveMediaItem', from, to);
    editQueue(() => {
      const [item] = queue.splice(from, 1);
      queue.splice(to, 0, item);
      if (active === null) return;
      if (active === from) active = to;
      else if (from < active && to >= active) active -= 1;
      else if (from > active && to <= active) active += 1;
    });
  },

  getQueue: () => [...queue],
  getActiveMediaItem: activeItem,
  getActiveIndex: () => active,
  getProgress: () => ({ position, duration: 0, buffered: 0 }),
  isPlaying: () => playing,

  setRepeatMode(mode) {
    record('setRepeatMode', mode);
    repeat = mode;
  },
  setShuffleModeEnabled: (enabled) => record('setShuffleModeEnabled', enabled),

  sleepAfter: (seconds) => record('sleepAfter', seconds),
  cancelSleep: () => record('cancelSleep'),

  setBrowseTree: (categories) => record('setBrowseTree', categories),

  usePlaybackState: () => playbackState,
  useIsPlaying: () => playing,
};

/** I comandi del test: quello che il nativo farebbe da solo. */
export const fakePlayer = {
  /** I nomi dei comandi ricevuti dall'ultimo `clearCalls`, in ordine; le letture non contano. */
  calls: (): string[] => calls.map((c) => c.name),
  /** Gli argomenti di ogni chiamata a `name`. */
  argsOf: (name: string): unknown[][] => calls.filter((c) => c.name === name).map((c) => c.args),
  clearCalls(): void {
    calls = [];
  },

  /** Consegna gli eventi in attesa, anche quelli nati mentre li si consegna. */
  flush(): void {
    while (pending.length > 0) deliver(pending.shift() as PlayerEvent);
  },

  /** Un evento che viene dal nativo, consegnato subito. */
  emit(event: PlayerEvent): void {
    if (event.type === 'isPlayingChanged') playing = event.playing;
    if (event.type === 'playbackStateChanged') playbackState = event.state;
    deliver(event);
  },
};

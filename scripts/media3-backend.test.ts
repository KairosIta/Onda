/// <reference types="node" />

import assert from 'node:assert/strict';
import test, { mock } from 'node:test';
import type {
  NativeMediaItem,
  NativeMediaItemInput,
  NativePlayerEvent,
} from '../modules/onda-player';
import {
  type AppStateLike,
  createMedia3Backend,
  createPlaybackSignals,
  type NativePlayer,
} from '../src/player/media3Backend';
import type { MediaItem, PlayerEvent } from '../src/player/types';

/**
 * L'adattatore sul modulo Media3 sopra un modulo nativo finto: identita'
 * degli elementi, conversioni e instradamento degli eventi. Il player vero
 * lo prova il collaudo su device; le regole di Onda, il player finto degli
 * altri test.
 */

type Raw = Omit<NativeMediaItemInput, 'key'> & { key: string | null };

/** Un modulo nativo minimo: una coda, le chiamate ricevute e gli eventi da mandare. */
function fakeNative() {
  let queue: Raw[] = [];
  let active: number | null = null;
  let listener: ((event: NativePlayerEvent) => void) | null = null;
  const calls: { name: string; args: unknown[] }[] = [];
  const record =
    (name: string) =>
    (...args: unknown[]) => {
      calls.push({ name, args });
    };
  const out = (r: Raw): NativeMediaItem => ({
    key: r.key,
    mediaId: r.mediaId,
    url: r.url,
    title: r.title ?? null,
    artist: r.artist ?? null,
    artworkUrl: r.artworkUrl ?? null,
    duration: r.duration ?? null,
    extras: r.extras ?? null,
  });

  const native: NativePlayer = {
    addListener(_name, l) {
      listener = l;
      return { remove: () => (listener = null) };
    },
    setup: record('setup'),
    play: record('play'),
    pause: record('pause'),
    seekTo: record('seekTo'),
    skipToNext: record('skipToNext'),
    skipToNextAfterError: () => false,
    skipToPrevious: record('skipToPrevious'),
    skipToIndex: record('skipToIndex'),
    retry: record('retry'),
    scheduleRetry: record('scheduleRetry'),
    cancelRetry: record('cancelRetry'),
    setMediaItems(items, startIndex) {
      record('setMediaItems')(items, startIndex);
      queue = items.map((i) => ({ ...i }));
      active = items.length > 0 ? startIndex : null;
    },
    addMediaItem(item) {
      record('addMediaItem')(item);
      queue.push({ ...item });
    },
    insertMediaItems: record('insertMediaItems'),
    removeMediaItems: record('removeMediaItems'),
    moveMediaItem: record('moveMediaItem'),
    getQueue: () => queue.map(out),
    getActiveIndex: () => active,
    getActiveMediaItem: () => (active === null ? null : out(queue[active])),
    getProgress: () => ({ position: 12.5, duration: 200, buffered: 30 }),
    isPlaying: () => false,
    getPlaybackState: () => 'idle',
    setRepeatMode: record('setRepeatMode'),
    setShuffleModeEnabled: record('setShuffleModeEnabled'),
    sleepAfter: record('sleepAfter'),
    cancelSleep: record('cancelSleep'),
    setBrowseTree: record('setBrowseTree'),
  };

  return {
    native,
    calls,
    /** Un evento dal nativo. */
    emit: (event: NativePlayerEvent) => listener?.(event),
    /** La coda come la lascerebbe Android Auto: elementi senza chiave del JS. */
    replaceQueue(items: Raw[], index: number) {
      queue = items;
      active = index;
    },
  };
}

function setup(state: 'active' | 'background' = 'active') {
  const fake = fakeNative();
  const appState: { currentState: string } = { currentState: state };
  const backend = createMedia3Backend(fake.native, appState as AppStateLike);
  return { ...fake, appState, backend };
}

/** Lascia passare la fila degli eventi, che consegna in microtask. */
const settle = () => new Promise<void>((resolve) => setImmediate(resolve));

const item = (id: string, extras?: Record<string, unknown>): MediaItem => ({
  mediaId: `audius:${id}`,
  url: `https://x.test/${id}`,
  title: `Titolo ${id}`,
  duration: 180,
  extras,
});

test('il recupero atomico riporta il verdetto nativo senza inviare play separati', () => {
  const { native, backend, calls } = setup();
  assert.equal(backend.skipToNextAfterError(), false);
  native.skipToNextAfterError = () => true;
  assert.equal(backend.skipToNextAfterError(), true);
  assert.deepEqual(calls, []);
});

test('un elemento torna come lo stesso oggetto, con gli extras intatti', () => {
  const { backend, calls } = setup();
  const a = item('a', { track: { uid: 'audius:a', tags: ['x'] } });
  const b = item('b');
  backend.setMediaItems([a, b], 1);

  const sent = calls[0].args[0] as NativeMediaItemInput[];
  assert.equal(sent[0].extras, JSON.stringify(a.extras));
  assert.equal(sent[0].duration, 180, 'i tempi restano in secondi');
  assert.strictEqual(backend.getQueue()[0], a);
  assert.strictEqual(backend.getActiveMediaItem(), b);
  assert.equal(backend.getActiveIndex(), 1);
});

test('dopo una ricarica del JS le chiavi nuove non scavalcano gli elementi gia in coda', () => {
  const first = setup();
  first.backend.setMediaItems([item('a'), item('b')], 0);

  // Il servizio e' lo stesso, il JS no: la coda porta le chiavi di prima.
  const reloaded = createMedia3Backend(first.native, first.appState as AppStateLike);
  const before = reloaded.getQueue();
  assert.deepEqual(
    before.map((i) => i.mediaId),
    ['audius:a', 'audius:b'],
  );
  reloaded.addMediaItem(item('c'));

  const after = reloaded.getQueue();
  assert.deepEqual(
    after.map((i) => i.mediaId),
    ['audius:a', 'audius:b', 'audius:c'],
  );
  assert.strictEqual(after[0], before[0], "l'elemento ricostruito resta lo stesso oggetto");
  assert.equal(after[0].title, 'Titolo a');
});

test('un elemento che non viene dal JS si ricostruisce, e poi resta lo stesso', () => {
  const { backend, replaceQueue } = setup();
  replaceQueue(
    [{ key: null, mediaId: 'jamendo:1', url: 'https://x.test/1', title: 'Uno', extras: '{"a":1}' }],
    0,
  );
  const first = backend.getActiveMediaItem();
  assert.deepEqual(first, {
    mediaId: 'jamendo:1',
    url: 'https://x.test/1',
    title: 'Uno',
    artist: undefined,
    artworkUrl: undefined,
    duration: undefined,
    extras: { a: 1 },
  });
  assert.strictEqual(backend.getQueue()[0], first);
});

test('alla prima lettura della coda la cache dimentica gli elementi usciti', async () => {
  const { native, backend, calls, emit, replaceQueue } = setup();
  const reads = mock.method(native, 'getQueue');
  const a = item('a');
  backend.setMediaItems([a], 0);
  const keyOfA = (calls[0].args[0] as NativeMediaItemInput[])[0].key;

  backend.setMediaItems([item('b')], 0);
  emit({ type: 'queueChanged' });
  await settle();
  // L'evento da solo non fa leggere la coda dal nativo: la lettura intera
  // porta gli extras di ogni brano, e la fa gia' chi ne ha bisogno.
  assert.equal(reads.mock.callCount(), 0);
  assert.equal(backend.getQueue().length, 1);
  assert.equal(reads.mock.callCount(), 1);

  // Il nativo restituisce di nuovo l'elemento vecchio con la sua chiave:
  // non e' piu' in cache, quindi si ricostruisce invece di riusare `a`.
  replaceQueue([{ key: keyOfA, mediaId: a.mediaId, url: a.url }], 0);
  const back = backend.getActiveMediaItem();
  assert.notStrictEqual(back, a);
  assert.equal(back?.mediaId, a.mediaId);
});

test('inserire e togliere un elemento solo passano dai comandi a intervallo', () => {
  const { backend, calls } = setup();
  backend.insertMediaItem(2, item('c'));
  backend.removeMediaItem(4);
  assert.equal(calls[0].name, 'insertMediaItems');
  assert.equal(calls[0].args[0], 2);
  assert.equal((calls[0].args[1] as NativeMediaItemInput[]).length, 1);
  assert.deepEqual(calls[1], { name: 'removeMediaItems', args: [4, 5] });
});

test("l'albero di Android Auto viaggia come JSON", () => {
  const { backend, calls } = setup();
  const tree = [{ mediaId: 'onda:favorites', title: 'Preferiti', items: [] }];
  backend.setBrowseTree(tree);
  assert.deepEqual(calls[0], { name: 'setBrowseTree', args: [JSON.stringify(tree)] });
});

test('un evento va ai listener in primo piano, al gestore in background altrimenti', async () => {
  const { backend, emit, appState } = setup();
  const foreground: PlayerEvent[] = [];
  const background: PlayerEvent[] = [];
  backend.subscribe('playbackError', (e) => foreground.push(e));
  backend.registerBackgroundHandler((e) => {
    background.push(e);
  });

  emit({ type: 'playbackError', code: 'source', message: '404' });
  await settle();
  appState.currentState = 'background';
  emit({ type: 'playbackError', code: 'boh', message: 'x' });
  await settle();

  assert.deepEqual(foreground, [{ type: 'playbackError', code: 'source', message: '404' }]);
  assert.deepEqual(background, [{ type: 'playbackError', code: 'unknown', message: 'x' }]);
});

test('il gestore in background riceve gli eventi subito, in ordine, e un errore non ferma i successivi', (t) => {
  const error = mock.method(console, 'error', () => {});
  t.after(() => error.mock.restore());
  const { backend, emit } = setup('background');
  const seen: string[] = [];
  backend.registerBackgroundHandler((e) => {
    seen.push(e.type);
    if (e.type === 'mediaItemTransition') throw new Error('rotto');
  });

  emit({ type: 'mediaItemTransition', item: null });
  emit({ type: 'queueChanged' });
  // Niente microtask ne' timer di mezzo: in background i timer JS sono fermi,
  // e un evento consegnato "dopo" potrebbe non essere consegnato mai.
  assert.deepEqual(seen, ['mediaItemTransition', 'queueChanged']);
  assert.equal(error.mock.callCount(), 1);
});

test('un listener che lancia non ferma gli altri', async (t) => {
  const error = mock.method(console, 'error', () => {});
  t.after(() => error.mock.restore());
  const { backend, emit } = setup();
  const seen: boolean[] = [];
  backend.subscribe('isPlayingChanged', () => {
    throw new Error('rotto');
  });
  backend.subscribe('isPlayingChanged', (e) => seen.push(e.playing));

  emit({ type: 'isPlayingChanged', playing: true });
  await settle();
  assert.deepEqual(seen, [true]);
  assert.equal(error.mock.callCount(), 1);
});

test('stato e audio in uscita si aggiornano anche con gli eventi del background', () => {
  const signals = createPlaybackSignals({ state: 'idle', playing: false });
  let changes = 0;
  signals.subscribe(() => changes++);

  signals.apply({ type: 'playbackStateChanged', state: 'buffering' });
  signals.apply({ type: 'isPlayingChanged', playing: true });
  signals.apply({ type: 'isPlayingChanged', playing: true });
  assert.equal(signals.getState(), 'buffering');
  assert.equal(signals.getPlaying(), true);
  assert.equal(changes, 2, 'niente notifica se non cambia niente');
});

test('i tempi del progresso arrivano in secondi', () => {
  const { backend } = setup();
  assert.deepEqual(backend.getProgress(), { position: 12.5, duration: 200, buffered: 30 });
});

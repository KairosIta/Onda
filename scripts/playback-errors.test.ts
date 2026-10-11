/// <reference types="node" />

import assert from 'node:assert/strict';
import test, { afterEach, mock } from 'node:test';
import { player, type PlayerEvent } from '@/player';
import { toMediaItem } from '@/services/mediaItems';
import { MAX_SOURCE_SKIPS, NETWORK_RETRY_DELAYS_MS } from '@/services/playbackPolicy';
import { playbackService, startForegroundPlaybackListeners } from '@/services/playbackService';
import { hasPlaybackFault } from '@/store/playbackFault';
import type { Track } from '@/types/track';
import { fakePlayer } from './doubles/player';

/**
 * La reazione agli errori di riproduzione sopra il player finto: quando si
 * salta un brano, quando ci si ferma con l'avviso e quando si riprova da
 * soli. La regola pura sta in `playbackPolicy` e ha i suoi test; qui si
 * prova che il servizio la applica con i comandi giusti.
 */

const track = (id: string): Track => ({
  uid: `audius:${id}`,
  source: 'audius',
  id,
  title: `Traccia ${id}`,
  artist: 'Artista',
  durationSec: 120,
  streamUrl: `https://example.test/${id}.mp3`,
});

const brokenTrack: PlayerEvent = { type: 'playbackError', code: 'source', message: '404' };
const networkDown: PlayerEvent = { type: 'playbackError', code: 'network', message: 'timeout' };

// Ogni errore finisce anche nel log: qui sarebbe solo rumore.
mock.method(console, 'warn', () => {});
startForegroundPlaybackListeners();

// Ogni test si chiude consegnando gli eventi rimasti: al test dopo non arriva
// niente di suo.
afterEach(() => {
  fakePlayer.flush();
  fakePlayer.clearCalls();
});

/**
 * Una coda nuova, dopo un brano che ha suonato: budget di salti pieno e
 * nessun tentativo in sospeso.
 */
function playQueue(length: number, index = 0): void {
  const tracks = Array.from({ length }, (_, i) => track(`t${i}`));
  player.setMediaItems(tracks.map(toMediaItem), index);
  fakePlayer.flush();
  fakePlayer.emit({ type: 'isPlayingChanged', playing: true });
  fakePlayer.emit({ type: 'isPlayingChanged', playing: false });
  fakePlayer.clearCalls();
}

test('un brano illeggibile si salta: avanti, ripreparato e play', () => {
  playQueue(5);
  fakePlayer.emit(brokenTrack);
  assert.deepEqual(fakePlayer.calls(), ['skipToNext', 'retry', 'play']);
  assert.equal(player.getActiveIndex(), 1);
  assert.equal(hasPlaybackFault(), false);
});

test("dopo tre brani rotti di fila ci si ferma con l'avviso", () => {
  playQueue(10);
  for (let i = 0; i < MAX_SOURCE_SKIPS; i++) {
    fakePlayer.emit(brokenTrack);
    fakePlayer.flush();
  }
  fakePlayer.clearCalls();

  fakePlayer.emit(brokenTrack);
  assert.deepEqual(fakePlayer.calls(), [], 'budget finito: la coda non si consuma');
  assert.equal(hasPlaybackFault(), true);
});

test('basta un brano che suona per ricaricare il budget', () => {
  playQueue(10);
  for (let i = 0; i < MAX_SOURCE_SKIPS; i++) {
    fakePlayer.emit(brokenTrack);
    fakePlayer.flush();
  }
  fakePlayer.emit({ type: 'isPlayingChanged', playing: true });
  fakePlayer.clearCalls();

  fakePlayer.emit(brokenTrack);
  assert.deepEqual(fakePlayer.calls(), ['skipToNext', 'retry', 'play']);
});

test("l'ultimo brano della coda non si salta", () => {
  playQueue(3, 2);
  fakePlayer.emit(brokenTrack);
  assert.deepEqual(fakePlayer.calls(), []);
  assert.equal(hasPlaybackFault(), true);
});

test('dopo un errore di rete si riprova da soli, a distanze crescenti', (t) => {
  mock.timers.enable({ apis: ['setTimeout'] });
  t.after(() => mock.timers.reset());
  playQueue(5);

  for (const delay of NETWORK_RETRY_DELAYS_MS) {
    fakePlayer.emit(networkDown);
    assert.equal(hasPlaybackFault(), true, "l'avviso resta finché il tentativo non riesce");
    mock.timers.tick(delay - 1);
    assert.deepEqual(fakePlayer.calls(), [], `nessun tentativo prima di ${delay} ms`);
    mock.timers.tick(1);
    assert.deepEqual(fakePlayer.calls(), ['retry', 'play']);
    fakePlayer.clearCalls();
  }

  fakePlayer.emit(networkDown);
  mock.timers.tick(60_000);
  assert.deepEqual(fakePlayer.calls(), [], 'esauriti i tentativi resta Riprova');
  assert.equal(player.getActiveIndex(), 0, 'un errore di rete non consuma la coda');
});

test('un cambio di brano annulla il tentativo in sospeso', (t) => {
  mock.timers.enable({ apis: ['setTimeout'] });
  t.after(() => mock.timers.reset());
  playQueue(5);

  fakePlayer.emit(networkDown);
  player.skipToNext();
  fakePlayer.flush();
  assert.equal(hasPlaybackFault(), false);
  fakePlayer.clearCalls();
  mock.timers.tick(NETWORK_RETRY_DELAYS_MS[0]);
  assert.deepEqual(fakePlayer.calls(), []);
});

test('il gestore in background reagisce come quello in primo piano', async () => {
  playQueue(5);
  await playbackService(brokenTrack);
  assert.deepEqual(fakePlayer.calls(), ['skipToNext', 'retry', 'play']);
});

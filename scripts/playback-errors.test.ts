/// <reference types="node" />

import assert from 'node:assert/strict';
import test, { afterEach, mock } from 'node:test';
import { player, type PlayerEvent } from '@/player';
import { toMediaItem } from '@/services/mediaItems';
import { MAX_SOURCE_SKIPS, NETWORK_RETRY_DELAYS_MS } from '@/services/playbackPolicy';
import { playbackService, startForegroundPlaybackListeners } from '@/services/playbackService';
import { derivePlaybackStatus } from '@/services/playbackStatus';
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
  assert.deepEqual(fakePlayer.calls(), ['skipToNextAfterError']);
  assert.equal(player.getActiveIndex(), 1);
  assert.equal(hasPlaybackFault(), false);
});

for (const code of ['source', 'renderer', 'unknown'] as const) {
  for (const background of [false, true]) {
    test(`pausa prima di un errore ${code} tardivo (${background ? 'background' : 'primo piano'}): nessuna ripartenza`, async () => {
      playQueue(5);
      player.pause();
      fakePlayer.clearCalls();
      const event: PlayerEvent = { type: 'playbackError', code, message: 'errore tardivo' };
      if (background) await playbackService(event);
      else fakePlayer.emit(event);

      assert.equal(player.getActiveIndex(), 0, 'la pausa conserva anche il brano');
      assert.equal(fakePlayer.calls().includes('play'), false);
      assert.equal(hasPlaybackFault(), true, 'resta disponibile il Riprova esplicito');
    });
  }
}

test('il buffering con play ancora richiesto permette di recuperare il brano seguente', () => {
  playQueue(5);
  player.play();
  fakePlayer.emit({ type: 'playbackStateChanged', state: 'buffering' });
  fakePlayer.emit({ type: 'isPlayingChanged', playing: false });
  fakePlayer.clearCalls();
  fakePlayer.emit(brokenTrack);
  assert.equal(player.getActiveIndex(), 1);
  assert.deepEqual(fakePlayer.calls(), ['skipToNextAfterError']);
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
  assert.deepEqual(fakePlayer.calls(), ['skipToNextAfterError']);
});

test("l'ultimo brano della coda non si salta", () => {
  playQueue(3, 2);
  fakePlayer.emit(brokenTrack);
  assert.deepEqual(fakePlayer.calls(), []);
  assert.equal(hasPlaybackFault(), true);
});

test('dopo un errore di rete si riprova da soli, a distanze crescenti', () => {
  playQueue(5);

  for (const delay of NETWORK_RETRY_DELAYS_MS) {
    fakePlayer.emit(networkDown);
    assert.equal(hasPlaybackFault(), true, "l'avviso resta finché il tentativo non riesce");
    // Il timer e' del player: con l'app in background quelli JS sono fermi.
    assert.deepEqual(fakePlayer.calls(), ['scheduleRetry']);
    assert.deepEqual(fakePlayer.argsOf('scheduleRetry'), [[delay / 1000]]);
    fakePlayer.clearCalls();
  }

  fakePlayer.emit(networkDown);
  assert.deepEqual(fakePlayer.calls(), [], 'esauriti i tentativi resta Riprova');
  assert.equal(player.getActiveIndex(), 0, 'un errore di rete non consuma la coda');
});

test('un cambio di brano annulla il tentativo in attesa', () => {
  playQueue(5);

  fakePlayer.emit(networkDown);
  player.skipToNext();
  fakePlayer.flush();
  assert.deepEqual(fakePlayer.calls(), ['scheduleRetry', 'skipToNext', 'cancelRetry']);
  assert.equal(hasPlaybackFault(), false);
});

test('un brano che torna a suonare chiude il tentativo e ricarica i tentativi', () => {
  playQueue(5);

  fakePlayer.emit(networkDown);
  fakePlayer.emit({ type: 'isPlayingChanged', playing: true });
  assert.deepEqual(fakePlayer.calls(), ['scheduleRetry', 'cancelRetry']);
  fakePlayer.clearCalls();

  fakePlayer.emit(networkDown);
  assert.deepEqual(
    fakePlayer.argsOf('scheduleRetry'),
    [[NETWORK_RETRY_DELAYS_MS[0] / 1000]],
    'il prossimo tunnel riparte dalla prima attesa',
  );
});

test('il gestore in background reagisce come quello in primo piano', async () => {
  playQueue(5);
  await playbackService(brokenTrack);
  assert.deepEqual(fakePlayer.calls(), ['skipToNextAfterError']);
});

test('il recupero della rete in background aggiorna lo stato visibile senza cambiare brano', async () => {
  playQueue(5);
  await playbackService(networkDown);
  assert.equal(hasPlaybackFault(), true);

  // Dopo l'errore Media3 torna idle: l'avviso deve restare fino al retry.
  await playbackService({ type: 'playbackStateChanged', state: 'idle' });
  assert.equal(hasPlaybackFault(), true);

  await playbackService({ type: 'playbackStateChanged', state: 'buffering' });
  assert.equal(hasPlaybackFault(), false, 'il retry supera il vecchio errore anche in background');
  assert.equal(
    derivePlaybackStatus({
      state: 'buffering',
      playing: false,
      hasItem: true,
      pending: false,
      fault: hasPlaybackFault(),
    }),
    'buffering',
  );

  await playbackService({ type: 'playbackStateChanged', state: 'ready' });
  await playbackService({ type: 'isPlayingChanged', playing: true });
  assert.equal(
    derivePlaybackStatus({
      state: 'ready',
      playing: true,
      hasItem: true,
      pending: false,
      fault: hasPlaybackFault(),
    }),
    'playing',
    'riaprendo il player non deve comparire Riprova mentre la musica suona',
  );
  assert.equal(player.getActiveIndex(), 0, 'il recupero non salta il brano');
  assert.deepEqual(fakePlayer.calls(), ['scheduleRetry', 'cancelRetry']);

  fakePlayer.clearCalls();
  await playbackService(networkDown);
  assert.deepEqual(
    fakePlayer.argsOf('scheduleRetry'),
    [[NETWORK_RETRY_DELAYS_MS[0] / 1000]],
    'un nuovo errore riparte dal primo tentativo',
  );
});

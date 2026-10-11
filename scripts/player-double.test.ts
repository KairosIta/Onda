/// <reference types="node" />

import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import { type MediaItem, player } from '@/player';
import { fakePlayer } from './doubles/player';

/**
 * Il player finto sui casi in cui il contratto segue Media3 (`backend.ts`):
 * gli altri test ci costruiscono sopra, quindi deve dare le stesse risposte
 * del player vero. Quello vero lo prova il collaudo su device.
 */

const item = (id: string): MediaItem => ({ mediaId: `audius:${id}`, url: `https://x.test/${id}` });

afterEach(() => {
  player.setRepeatMode('off');
  fakePlayer.flush();
  fakePlayer.clearCalls();
});

function load(length: number, index: number): void {
  player.setMediaItems(
    Array.from({ length }, (_, i) => item(`t${i}`)),
    index,
  );
}

test("indietro sul primo brano riavvolge, con ripeti tutto va all'ultimo", () => {
  load(3, 0);
  player.skipToPrevious();
  assert.equal(player.getActiveIndex(), 0);

  player.setRepeatMode('all');
  player.skipToPrevious();
  assert.equal(player.getActiveIndex(), 2);
});

test('indietro oltre i primi 3 secondi riavvolge il brano attivo', () => {
  load(3, 1);
  player.seekTo(10);
  player.skipToPrevious();
  assert.equal(player.getActiveIndex(), 1);
  assert.equal(player.getProgress().position, 0);
});

test("avanti sull'ultimo brano non fa niente, ripeti uno compreso", () => {
  load(3, 2);
  player.setRepeatMode('one');
  player.skipToNext();
  assert.equal(player.getActiveIndex(), 2);

  player.setRepeatMode('all');
  player.skipToNext();
  assert.equal(player.getActiveIndex(), 0);
});

test('tolto il brano attivo in fondo, tocca al primo della coda', () => {
  load(4, 3);
  player.removeMediaItems(2, 4);
  assert.equal(player.getActiveIndex(), 0);
  assert.equal(player.getActiveMediaItem()?.mediaId, 'audius:t0');
});

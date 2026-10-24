/// <reference types="node" />

import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import { readJSON } from '@/services/storage';
import { applyRepeat, cycleRepeat, getRepeat, getShuffle, toggleShuffle } from '@/store/playback';
import { loadPlaybackPrefs } from '@/store/playbackSchema';
import { fakePlayer } from './doubles/player';

/**
 * Shuffle e ripetizione sono stati del player nativo che devono anche
 * sopravvivere al riavvio: ogni cambio va sia al player sia su disco, e
 * all'avvio la preferenza salvata torna al player.
 */

const KEY = 'playback.v1';
const onDisk = () => loadPlaybackPrefs(readJSON(KEY));

afterEach(() => {
  fakePlayer.flush();
  fakePlayer.clearCalls();
});

test('lo shuffle va al player e su disco a ogni toggle', () => {
  const before = getShuffle();
  toggleShuffle();
  assert.equal(getShuffle(), !before);
  assert.equal(onDisk().shuffle, !before);
  assert.deepEqual(fakePlayer.argsOf('setShuffleModeEnabled'), [[!before]]);

  toggleShuffle();
  assert.equal(getShuffle(), before);
  assert.equal(onDisk().shuffle, before);
});

test('la ripetizione gira coda, brano, niente, e ogni passo arriva al player e su disco', () => {
  const seen: string[] = [];
  for (let i = 0; i < 3; i++) seen.push(cycleRepeat());
  const start = seen.indexOf('all');
  const expected = ['all', 'one', 'off'];
  assert.deepEqual(
    seen.map((_, i) => seen[(start + i) % 3]),
    expected,
    'il ciclo e sempre coda, brano, niente',
  );
  assert.equal(getRepeat(), seen[2]);
  assert.equal(onDisk().repeat, seen[2]);
  assert.deepEqual(
    fakePlayer.argsOf('setRepeatMode').map(([mode]) => mode),
    seen,
    'ogni passo e stato mandato al player, nell ordine',
  );
});

test('applyRepeat rimanda al player entrambe le preferenze salvate', () => {
  applyRepeat();
  assert.deepEqual(fakePlayer.argsOf('setRepeatMode'), [[getRepeat()]]);
  assert.deepEqual(fakePlayer.argsOf('setShuffleModeEnabled'), [[getShuffle()]]);
});

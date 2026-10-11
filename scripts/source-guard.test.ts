/// <reference types="node" />

import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import { player } from '@/player';
import { toMediaItem } from '@/services/mediaItems';
import { startSourceGuard } from '@/services/sourceGuard';
import {
  getPendingQueue,
  restoreSession,
  saveQueueSnapshot,
  startSessionPersistence,
} from '@/store/session';
import { setCredential, setSourceEnabled } from '@/store/sources';
import type { SourceId, Track } from '@/types/track';
import { fakePlayer } from './doubles/player';

/**
 * Il guardiano delle sorgenti sopra il player finto e lo store vero delle
 * sorgenti: spegnerne una toglie i suoi brani dal player e dalla coda in
 * attesa, senza fermare quello che resta.
 */

const track = (source: SourceId, id: string): Track => ({
  uid: `${source}:${id}`,
  source,
  id,
  title: `Traccia ${id}`,
  artist: 'Artista',
  durationSec: 120,
  streamUrl: `https://example.test/${id}.mp3`,
});

// Jamendo lavora solo con un Client ID: uno finto, nel Keystore in memoria.
setCredential('jamendoClientId', 'client-id-di-prova');
startSessionPersistence();

// Ogni test si chiude consegnando gli eventi rimasti: al test dopo non arriva
// niente di suo.
afterEach(() => {
  fakePlayer.flush();
  fakePlayer.clearCalls();
});

function play(queue: Track[], index: number): void {
  player.setMediaItems(queue.map(toMediaItem), index);
  fakePlayer.flush();
  fakePlayer.clearCalls();
}

const uids = (): string[] => player.getQueue().map((item) => item.mediaId);

// Deve restare il primo test: il guardiano parte una volta per processo e
// la pulizia all'avvio si vede solo qui. Negli altri `startSourceGuard` non
// fa niente, ma permette di lanciarli anche da soli.
test("all'avvio la coda sopravvissuta perde subito i brani spenti", (t) => {
  t.after(() => setSourceEnabled('jamendo', true));
  // Il servizio e' sopravvissuto a una ricarica del solo JS, con una coda
  // di prima; nel frattempo Jamendo e' stato spento.
  play([track('audius', 'a'), track('jamendo', 'j'), track('audius', 'b')], 0);
  setSourceEnabled('jamendo', false);
  startSourceGuard();
  assert.deepEqual(uids(), ['audius:a', 'audius:b']);
});

test('spenta una sorgente, il player passa al primo brano che resta', (t) => {
  t.after(() => setSourceEnabled('jamendo', true));
  startSourceGuard();
  play(
    [track('audius', 'a'), track('jamendo', 'j1'), track('jamendo', 'j2'), track('audius', 'b')],
    1,
  );

  setSourceEnabled('jamendo', false);
  assert.deepEqual(fakePlayer.calls(), ['removeMediaItems']);
  assert.deepEqual(uids(), ['audius:a', 'audius:b']);
  assert.equal(player.getActiveMediaItem()?.mediaId, 'audius:b');
});

test("più tratti spenti escono dall'ultimo, senza sbagliare indici", (t) => {
  t.after(() => setSourceEnabled('jamendo', true));
  startSourceGuard();
  play(
    [
      track('jamendo', 'j1'),
      track('audius', 'a'),
      track('jamendo', 'j2'),
      track('jamendo', 'j3'),
      track('audius', 'b'),
    ],
    1,
  );

  setSourceEnabled('jamendo', false);
  assert.deepEqual(fakePlayer.argsOf('removeMediaItems'), [
    [2, 4],
    [0, 1],
  ]);
  assert.deepEqual(uids(), ['audius:a', 'audius:b']);
  assert.equal(player.getActiveMediaItem()?.mediaId, 'audius:a', 'il brano che suona non cambia');
});

test('riaccendere una sorgente non tocca la coda', () => {
  startSourceGuard();
  setSourceEnabled('jamendo', false);
  play([track('audius', 'a')], 0);
  setSourceEnabled('jamendo', true);
  assert.deepEqual(fakePlayer.calls(), []);
});

test('la coda in attesa perde i brani spenti, il player resta fermo', (t) => {
  t.after(() => setSourceEnabled('jamendo', true));
  startSourceGuard();
  play([track('audius', 'a'), track('jamendo', 'j'), track('audius', 'b')], 0);
  saveQueueSnapshot();
  play([], 0);
  restoreSession();

  setSourceEnabled('jamendo', false);
  assert.deepEqual(
    getPendingQueue()?.tracks.map((item) => item.uid),
    ['audius:a', 'audius:b'],
  );
  assert.deepEqual(fakePlayer.calls(), [], 'niente stream prima del play');
});

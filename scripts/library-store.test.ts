/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';
import { readJSON } from '@/services/storage';
import {
  addToPlaylist,
  clearHistory,
  createPlaylist,
  deletePlaylist,
  getLibrary,
  importLibrary,
  isFavorite,
  movePlaylistTrack,
  recordPlay,
  remember,
  removeFromPlaylist,
  renamePlaylist,
  resolve,
  subscribeLibrary,
  toggleFavorite,
  tracksOf,
} from '@/store/library';
import { EXPORT_MAX_BYTES, buildExport, parseExport } from '@/store/libraryExport';
import { HISTORY_MAX, loadLibrary } from '@/store/librarySchema';
import type { Track } from '@/types/track';

/**
 * Lo store della libreria sopra l'MMKV finto: ogni mutazione deve lasciare
 * su disco esattamente lo stato che i componenti leggono, e il catalogo
 * persistito deve tenere solo le tracce ancora referenziate. E' la parte
 * in cui un errore costa dati, quindi si prova lo store vero, non lo schema.
 */

const KEY = 'library.v1';

const track = (id: string): Track => ({
  uid: `audius:${id}`,
  source: 'audius',
  id,
  title: `Brano ${id}`,
  artist: 'Tizio',
  durationSec: 100,
  streamUrl: `https://example.test/${id}.mp3`,
});

/** Cio' che c'e' davvero su disco, riletto come lo rileggerebbe l'app. */
const onDisk = () => loadLibrary(readJSON(KEY));
/** Lo stato in memoria nella stessa forma normalizzata, per confrontarlo con il disco. */
const inMemory = () => loadLibrary(getLibrary());

test('preferiti: il toggle salva la traccia e, tolta, la pota dal catalogo', () => {
  const a = track('fav-a');
  let notified = 0;
  const stop = subscribeLibrary(() => notified++);

  toggleFavorite(a);
  assert.equal(isFavorite(a.uid), true);
  assert.deepEqual(getLibrary().favorites, [a.uid]);
  assert.deepEqual(getLibrary().tracks[a.uid], a, 'la traccia entra nel catalogo persistito');
  assert.deepEqual(onDisk(), inMemory(), 'su disco c e lo stesso stato');
  assert.equal(notified, 1, 'un avviso per mutazione');

  toggleFavorite(a);
  assert.equal(isFavorite(a.uid), false);
  assert.equal(getLibrary().tracks[a.uid], undefined, 'niente la referenzia piu: potata');
  assert.deepEqual(onDisk().favorites, []);
  assert.equal(notified, 2);
  stop();
});

test('cronologia: una riproduzione entra una volta in testa, il tetto e cento, e si svuota', () => {
  const before = getLibrary();
  recordPlay('audius:mai-vista');
  assert.equal(getLibrary(), before, 'una traccia mai vista non e un salvataggio');

  const a = track('hist-a');
  const b = track('hist-b');
  remember([a, b]);
  recordPlay(a.uid);
  const afterA = getLibrary();
  assert.deepEqual(afterA.history, [a.uid]);
  recordPlay(a.uid);
  assert.equal(getLibrary(), afterA, 'gia in testa: nessuna scrittura');
  recordPlay(b.uid);
  recordPlay(a.uid);
  assert.deepEqual(getLibrary().history, [a.uid, b.uid], 'torna in testa senza doppioni');

  const many = Array.from({ length: HISTORY_MAX + 5 }, (_, i) => track(`hist-${i}`));
  remember(many);
  for (const t of many) recordPlay(t.uid);
  assert.equal(getLibrary().history.length, HISTORY_MAX);
  assert.equal(getLibrary().history[0], many[many.length - 1].uid, 'la piu recente in testa');
  assert.equal(onDisk().history.length, HISTORY_MAX);
  assert.equal(
    Object.keys(getLibrary().tracks).length,
    HISTORY_MAX,
    'il catalogo tiene solo le tracce ancora in cronologia',
  );

  clearHistory();
  assert.deepEqual(getLibrary().history, []);
  assert.deepEqual(getLibrary().tracks, {}, 'svuotata la cronologia, il catalogo si svuota');
  assert.deepEqual(onDisk().history, []);
});

test('il catalogo di sessione ha un tetto, ma una traccia salvata si risolve sempre', () => {
  const saved = track('saved');
  toggleFavorite(saved);
  const first = track('session-0');
  const flood = Array.from({ length: 600 }, (_, i) => track(`session-${i}`));
  remember(flood);

  assert.equal(resolve(first.uid), undefined, 'la piu vecchia e stata sfrattata');
  assert.deepEqual(resolve(flood[flood.length - 1].uid), flood[flood.length - 1]);
  assert.deepEqual(resolve(saved.uid), saved, 'quella salvata ricade sul catalogo persistito');
  assert.deepEqual(
    tracksOf([saved.uid, first.uid, 'audius:nessuna']).map((t) => t.uid),
    [saved.uid],
    'gli uid che non risolvono si scartano',
  );

  toggleFavorite(saved);
});

test('playlist: creazione, rinomina, aggiunte senza doppioni, spostamenti nei limiti, rimozioni', () => {
  const a = track('pl-a');
  const b = track('pl-b');
  const anon = createPlaylist('   ', [a]);
  assert.equal(getLibrary().playlists.find((p) => p.id === anon)?.name, 'Senza titolo');
  assert.deepEqual(getLibrary().playlists.find((p) => p.id === anon)?.trackUids, [a.uid]);

  const id = createPlaylist('Sera');
  assert.equal(getLibrary().playlists[0].id, id, 'la nuova sta in testa');
  assert.equal(addToPlaylist(id, a), true);
  assert.equal(addToPlaylist(id, a), false, 'doppione ignorato');
  assert.equal(addToPlaylist('inesistente', a), false);
  assert.equal(addToPlaylist(id, b), true);
  const uids = () => getLibrary().playlists.find((p) => p.id === id)?.trackUids;
  assert.deepEqual(uids(), [a.uid, b.uid]);

  movePlaylistTrack(id, 0, 1);
  assert.deepEqual(uids(), [b.uid, a.uid]);
  const stable = getLibrary();
  movePlaylistTrack(id, 0, 5);
  assert.deepEqual(uids(), [b.uid, a.uid], 'fuori dai limiti non si muove niente');
  assert.notEqual(getLibrary(), stable, 'ma lo store ha comunque scritto');

  renamePlaylist(id, '   ');
  assert.equal(getLibrary().playlists.find((p) => p.id === id)?.name, 'Sera', 'vuoto: resta');
  renamePlaylist(id, ' Notte ');
  assert.equal(getLibrary().playlists.find((p) => p.id === id)?.name, 'Notte');
  assert.equal(onDisk().playlists.find((p) => p.id === id)?.name, 'Notte');

  removeFromPlaylist(id, b.uid);
  assert.deepEqual(uids(), [a.uid]);
  assert.equal(getLibrary().tracks[b.uid], undefined, 'b non e piu referenziata: potata');

  deletePlaylist(id);
  deletePlaylist(anon);
  assert.deepEqual(getLibrary().playlists, []);
  assert.deepEqual(getLibrary().tracks, {});
  assert.deepEqual(onDisk().playlists, []);
});

test('import: fonde senza togliere, scrive una volta, e un file che non aggiunge niente non scrive', () => {
  const mine = track('imp-mine');
  toggleFavorite(mine);
  const theirs = track('imp-theirs');
  const incoming = loadLibrary({
    tracks: { [theirs.uid]: theirs, [mine.uid]: { ...mine, title: 'Vecchio titolo' } },
    favorites: [theirs.uid, mine.uid],
    playlists: [{ id: 'p-imp', name: 'Corsa', createdAt: 1, trackUids: [theirs.uid] }],
    history: [theirs.uid],
  });

  let notified = 0;
  const stop = subscribeLibrary(() => notified++);
  const preview = importLibrary(incoming);
  assert.deepEqual(
    { ...preview },
    {
      newFavorites: 1,
      newPlaylists: 1,
      grownPlaylists: 0,
      newTracks: 1,
      newHistory: 1,
      empty: false,
    },
  );
  assert.equal(notified, 1);
  const after = getLibrary();
  assert.deepEqual(after.favorites, [mine.uid, theirs.uid], 'i miei restano davanti');
  assert.equal(after.tracks[mine.uid].title, mine.title, 'sui metadati vince la mia copia');
  assert.deepEqual(
    after.playlists.map((p) => p.id),
    ['p-imp'],
  );
  assert.deepEqual(onDisk(), inMemory());

  const again = importLibrary(incoming);
  assert.equal(again.empty, true);
  assert.equal(getLibrary(), after, 'niente da importare: nessuna scrittura');
  assert.equal(notified, 1);
  stop();

  deletePlaylist('p-imp');
  clearHistory();
  toggleFavorite(mine);
  toggleFavorite(theirs);
  assert.deepEqual(getLibrary().tracks, {});
});

test('un file oltre il tetto si rifiuta prima di analizzarlo', () => {
  const small = JSON.stringify(buildExport(loadLibrary({})));
  assert.equal(parseExport(small).ok, true);

  const huge = `${small}${' '.repeat(EXPORT_MAX_BYTES)}`;
  const refused = parseExport(huge);
  assert.equal(refused.ok, false);
  assert.ok(!refused.ok && refused.reason.includes('MB'), 'il rifiuto dice il tetto');
});

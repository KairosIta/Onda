/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';
import { nextTracksOffset } from '@/hooks/infiniteTracksCursor';
import { audiusRightsLabel, audiusTrackUrl } from '@/services/sources/audius';
import { creativeCommonsLabel } from '@/services/sources/jamendo';
import { loadLibrary, parseTrack } from '@/store/librarySchema';
import { loadPlaybackPrefs } from '@/store/playbackSchema';
import type { Track } from '@/types/track';

const track = (id: string): Track => ({
  uid: `audius:${id}`,
  source: 'audius',
  id,
  title: `Traccia ${id}`,
  artist: 'Artista',
  durationSec: 120,
  streamUrl: `https://example.test/${id}.mp3`,
});

test('il permalink Audius diventa sempre un collegamento canonico', () => {
  assert.equal(audiusTrackUrl('/artista/brano'), 'https://audius.co/artista/brano');
  assert.equal(
    audiusTrackUrl('https://audius.co/artista/brano'),
    'https://audius.co/artista/brano',
  );
  assert.equal(audiusTrackUrl(undefined), undefined);
});

test('le licenze delle sorgenti diventano etichette compatte', () => {
  assert.equal(audiusRightsLabel(null), 'Tutti i diritti riservati');
  assert.equal(audiusRightsLabel('Attribution-NoDerivs CC BY-ND'), 'CC BY-ND');
  assert.equal(
    creativeCommonsLabel('https://creativecommons.org/licenses/by-nc-sa/3.0/'),
    'CC BY-NC-SA 3.0',
  );
});

test('parseTrack accetta una traccia valida e rimuove campi opzionali errati', () => {
  const parsed = parseTrack({
    ...track('1'),
    sourceUrl: 'https://audius.co/artista/brano',
    rightsLabel: 'CC BY-NC',
    artworkUrl: 42,
    albumName: '',
  });
  assert.equal(parsed?.uid, 'audius:1');
  assert.equal(parsed?.sourceUrl, 'https://audius.co/artista/brano');
  assert.equal(parsed?.rightsLabel, 'CC BY-NC');
  assert.equal(parsed?.artworkUrl, undefined);
  assert.equal(parsed?.albumName, undefined);
});

test('parseTrack rifiuta uid incoerenti e dati non riproducibili', () => {
  assert.equal(parseTrack({ ...track('1'), uid: 'jamendo:1' }), undefined);
  assert.equal(parseTrack({ ...track('1'), streamUrl: '' }), undefined);
  assert.equal(parseTrack({ ...track('1'), durationSec: Number.NaN }), undefined);
});

test('loadLibrary recupera i campi sani senza conservare riferimenti orfani', () => {
  const valid = track('1');
  const loaded = loadLibrary({
    tracks: { valid, broken: { uid: 'broken' } },
    favorites: [valid.uid, valid.uid, 'audius:missing', 12],
    history: null,
    playlists: [
      { id: 'p1', name: '  Preferiti  ', createdAt: 10, trackUids: [valid.uid, 'audius:missing'] },
      { id: 'p1', name: 'Duplicata', createdAt: 11, trackUids: [] },
      { id: 2, name: 'Non valida', createdAt: 12, trackUids: [] },
    ],
  });

  assert.deepEqual(loaded.favorites, [valid.uid]);
  assert.deepEqual(loaded.history, []);
  assert.deepEqual(loaded.playlists, [
    { id: 'p1', name: 'Preferiti', createdAt: 10, trackUids: [valid.uid] },
  ]);
  assert.deepEqual(Object.keys(loaded.tracks), [valid.uid]);
});

test('loadLibrary limita la cronologia a cento tracce', () => {
  const tracks = Object.fromEntries(
    Array.from({ length: 105 }, (_, i) => {
      const item = track(String(i));
      return [item.uid, item];
    }),
  );
  const history = Object.keys(tracks);
  assert.equal(loadLibrary({ tracks, history }).history.length, 100);
});

test('il cursore termina su una pagina vuota completa', () => {
  assert.equal(nextTracksOffset({ offset: 40, trackCount: 0, failedCount: 0 }, 20), undefined);
});

test('il cursore riprova una pagina parziale senza saltare risultati', () => {
  assert.equal(nextTracksOffset({ offset: 40, trackCount: 20, failedCount: 1 }, 20), 40);
});

test('il cursore avanza dopo una pagina completa', () => {
  assert.equal(nextTracksOffset({ offset: 40, trackCount: 40, failedCount: 0 }, 20), 60);
});

const repeatModes = { off: 'off', one: 'one', all: 'all' } as const;

test('le preferenze playback partono con valori sicuri', () => {
  assert.deepEqual(loadPlaybackPrefs(undefined, repeatModes), { shuffle: false, repeat: 'off' });
  assert.deepEqual(loadPlaybackPrefs({ shuffle: 'si', repeat: 'sconosciuto' }, repeatModes), {
    shuffle: false,
    repeat: 'off',
  });
});

test('le preferenze playback conservano il formato corrente', () => {
  assert.deepEqual(loadPlaybackPrefs({ shuffle: true, repeat: 'one' }, repeatModes), {
    shuffle: true,
    repeat: 'one',
  });
});

test('le preferenze playback migrano i vecchi repeat numerici', () => {
  assert.equal(loadPlaybackPrefs({ repeat: 0 }, repeatModes).repeat, 'off');
  assert.equal(loadPlaybackPrefs({ repeat: 1 }, repeatModes).repeat, 'one');
  assert.equal(loadPlaybackPrefs({ repeat: 2 }, repeatModes).repeat, 'all');
});

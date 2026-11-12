/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';
import { readJSON, storage } from '@/services/storage';
import { createPlaylist, getLibrary, importLibrary, previewImport } from '@/store/library';
import {
  EXPORT_MAX_BYTES,
  IMPORT_LIMITS,
  buildExport,
  parseExport,
  serializeExport,
} from '@/store/libraryExport';
import { loadLibrary } from '@/store/librarySchema';
import type { Track } from '@/types/track';

const track = (id: string): Track => ({
  uid: `audius:${id}`,
  source: 'audius',
  id,
  title: `Brano ${id}`,
  artist: 'Tizio',
  durationSec: 100,
  streamUrl: `https://example.test/${id}.mp3`,
});

test('il limite del backup conta i byte UTF-8 sia in scrittura sia in lettura', () => {
  const name = '界'.repeat(IMPORT_LIMITS.fieldLength);
  const library = loadLibrary({
    playlists: Array.from({ length: 700 }, (_, i) => ({
      id: String(i),
      name,
      createdAt: i,
      trackUids: [],
    })),
  });
  const text = JSON.stringify(buildExport(library), null, 2);
  assert.ok(text.length < EXPORT_MAX_BYTES && Buffer.byteLength(text) > EXPORT_MAX_BYTES);
  assert.throws(() => serializeExport(library), /8 MB/);
  const parsed = parseExport(text);
  assert.ok(!parsed.ok && parsed.reason.includes('8 MB'));
});

test('due backup da 501 e 500 playlist si uniscono e la copia si ripristina su una libreria vuota', async () => {
  const empty = loadLibrary({});
  assert.deepEqual(getLibrary(), empty);
  function backup(prefix: string, count: number) {
    const a = track(prefix + '-a');
    const b = track(prefix + '-b');
    return loadLibrary({
      tracks: { [a.uid]: a, [b.uid]: b },
      favorites: [b.uid],
      history: [a.uid],
      playlists: Array.from({ length: count }, (_, i) => ({
        id: prefix + i,
        name: 'Playlist ' + prefix + i,
        createdAt: i,
        trackUids: [b.uid, a.uid],
      })),
    });
  }
  const a = backup('prima', 501);
  const b = backup('seconda', 500);
  for (const original of [a, b]) {
    const parsed = parseExport(serializeExport(original));
    assert.ok(parsed.ok);
    assert.equal(importLibrary(parsed.library).newPlaylists, original.playlists.length);
  }
  const expected = {
    tracks: { ...a.tracks, ...b.tracks },
    playlists: [...a.playlists, ...b.playlists],
    favorites: [...a.favorites, ...b.favorites],
    history: [...a.history, ...b.history],
  };
  assert.deepEqual(loadLibrary(readJSON('library.v1')), expected);
  const restored = parseExport(serializeExport(getLibrary()));
  assert.ok(restored.ok);

  // Entrava al momento dell'anteprima, ma un'altra playlist è stata
  // creata mentre l'utente decideva. Il rifiuto deve essere atomico.
  const incoming = backup('terza', IMPORT_LIMITS.playlists - expected.playlists.length);
  assert.equal(previewImport(incoming).newPlaylists, incoming.playlists.length);
  createPlaylist('Arrivata dopo');
  const before = getLibrary();
  assert.throws(() => importLibrary(incoming), /playlist/);
  assert.equal(getLibrary(), before);
  assert.deepEqual(loadLibrary(readJSON('library.v1')), loadLibrary(before));

  // Una seconda istanza dello store riparte con MMKV vuoto, come dopo
  // una reinstallazione. Il suffisso forza Node a rileggere il modulo.
  storage.delete('library.v1');
  const moduleUrl = new URL('../src/store/library.ts?ripristino', import.meta.url);
  const fresh: typeof import('@/store/library') = await import(moduleUrl.href);
  assert.deepEqual(fresh.getLibrary(), empty);
  assert.equal(fresh.importLibrary(restored.library).newPlaylists, 1001);
  assert.deepEqual(fresh.getLibrary(), expected);
  assert.deepEqual(loadLibrary(readJSON('library.v1')), expected);
});

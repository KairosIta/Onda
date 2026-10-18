/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ARTWORK_CACHE_POLICY_VERSION,
  artworkCacheKey,
  artworkCachePolicy,
  isArtworkDiskReady,
  migrateArtworkCache,
  setArtworkDiskReady,
} from '@/services/artworkCachePolicy';

test('gli artwork Audius e senza sorgente non vengono letti o scritti su disco', () => {
  assert.equal(artworkCachePolicy('audius'), 'memory');
  assert.equal(artworkCachePolicy(undefined), 'memory');
  assert.equal(artworkCachePolicy('jamendo'), 'memory-disk');
  // Finche' la vecchia cache non e' stata eliminata, nemmeno Jamendo va su disco.
  assert.equal(artworkCachePolicy('jamendo', false), 'memory');
  assert.equal(isArtworkDiskReady(), true);
  setArtworkDiskReady(false);
  try {
    assert.equal(artworkCachePolicy('jamendo'), 'memory');
  } finally {
    setArtworkDiskReady(true);
  }
  assert.notEqual(
    artworkCacheKey('audius', 'https://example.test/shared'),
    artworkCacheKey('jamendo', 'https://example.test/shared'),
  );
});

test('la vecchia cache viene cancellata prima di confermare la migrazione', async () => {
  let release: (cleared: boolean) => void = () => {};
  const calls: string[] = [];
  const pending = migrateArtworkCache(
    undefined,
    () => {
      calls.push('clear');
      return new Promise((resolve) => {
        release = resolve;
      });
    },
    () => calls.push('saved'),
  );
  assert.deepEqual(calls, ['clear']);
  release(true);
  assert.equal(await pending, true);
  assert.deepEqual(calls, ['clear', 'saved']);
});

test("una cancellazione fallita non ferma l'app, non avanza la versione e si ritenta", async () => {
  let version: number | undefined;
  const save = (next: number) => {
    version = next;
  };
  assert.equal(await migrateArtworkCache(version, async () => false, save), false);
  assert.equal(version, undefined);
  assert.equal(
    await migrateArtworkCache(
      version,
      async () => {
        throw new Error('cache occupata');
      },
      save,
    ),
    false,
    'nemmeno un errore del modulo blocca l’avvio',
  );
  assert.equal(version, undefined);
  assert.equal(await migrateArtworkCache(version, async () => true, save), true);
  assert.equal(version, ARTWORK_CACHE_POLICY_VERSION);
});

test('la cache Jamendo non viene cancellata agli avvii successivi', async () => {
  const ready = await migrateArtworkCache(
    ARTWORK_CACHE_POLICY_VERSION,
    async () => {
      assert.fail('nessuna nuova cancellazione');
    },
    () => assert.fail('nessuna nuova scrittura'),
  );
  assert.equal(ready, true);
});

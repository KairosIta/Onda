/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ARTWORK_CACHE_POLICY_VERSION,
  artworkCacheKey,
  artworkCachePolicy,
  migrateArtworkCache,
} from '@/services/artworkCachePolicy';

test('gli artwork Audius e senza sorgente non vengono letti o scritti su disco', () => {
  assert.equal(artworkCachePolicy('audius'), 'memory');
  assert.equal(artworkCachePolicy(undefined), 'memory');
  assert.equal(artworkCachePolicy('jamendo'), 'memory-disk');
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
  await pending;
  assert.deepEqual(calls, ['clear', 'saved']);
});

test('una cancellazione fallita non avanza la versione e si puo ritentare', async () => {
  let version: number | undefined;
  const save = (next: number) => {
    version = next;
  };
  await assert.rejects(migrateArtworkCache(version, async () => false, save));
  assert.equal(version, undefined);
  await assert.rejects(
    migrateArtworkCache(
      version,
      async () => {
        throw new Error('cache occupata');
      },
      save,
    ),
  );
  assert.equal(version, undefined);
  await migrateArtworkCache(version, async () => true, save);
  assert.equal(version, ARTWORK_CACHE_POLICY_VERSION);
});

test('la cache Jamendo non viene cancellata agli avvii successivi', async () => {
  await migrateArtworkCache(
    ARTWORK_CACHE_POLICY_VERSION,
    async () => {
      assert.fail('nessuna nuova cancellazione');
    },
    () => assert.fail('nessuna nuova scrittura'),
  );
});

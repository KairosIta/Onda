/// <reference types="node" />

import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
import { metroCacheVersion } from './metro-cache-version.cjs';

const env = (over: Record<string, string> = {}) => ({
  PATH: '/usr/bin',
  EXPO_PUBLIC_JAMENDO_CLIENT_ID: 'id-uno',
  EXPO_PUBLIC_AUDIUS_APP_NAME: 'Onda',
  ...over,
});

test('metro: con gli stessi valori pubblici la versione della cache non cambia', () => {
  assert.equal(metroCacheVersion(env()), metroCacheVersion(env()));
  // L'ordine delle variabili non conta.
  const { EXPO_PUBLIC_AUDIUS_APP_NAME, ...rest } = env();
  assert.equal(
    metroCacheVersion({ EXPO_PUBLIC_AUDIUS_APP_NAME, ...rest }),
    metroCacheVersion(env()),
  );
  // Le variabili non pubbliche non entrano nel bundle e non la toccano.
  assert.equal(
    metroCacheVersion(env({ PATH: '/altro', HOME: '/home/x' })),
    metroCacheVersion(env()),
  );
});

test('metro: un valore pubblico diverso cambia la versione della cache', () => {
  const base = metroCacheVersion(env());
  assert.notEqual(metroCacheVersion(env({ EXPO_PUBLIC_JAMENDO_CLIENT_ID: 'id-due' })), base);
  assert.notEqual(metroCacheVersion(env({ EXPO_PUBLIC_NUOVA: 'x' })), base);
  assert.notEqual(metroCacheVersion(env({ EXPO_PUBLIC_JAMENDO_CLIENT_ID: '' })), base);
});

test('metro: la versione estende quella di partenza e non contiene i valori', () => {
  const version = metroCacheVersion(env());
  assert.match(version, /^1\.0\+env-[0-9a-f]{16}$/u);
  assert.match(metroCacheVersion(env(), '2.5'), /^2\.5\+env-/u);
  assert.equal(version.includes('id-uno'), false);
});

test('metro: metro.config.js usa la versione che segue i valori pubblici', () => {
  const require = createRequire(import.meta.url);
  const config = require('../metro.config.js') as { cacheVersion: string };
  assert.equal(config.cacheVersion, metroCacheVersion(process.env, '1.0'));
});

/// <reference types="node" />

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { readBuildEnvironment } from './build-environment.ts';

const root = resolve(import.meta.dirname, '..');
const variants = [
  '.env',
  '.env.local',
  '.env.production',
  '.env.production.local',
  '.env.development',
  '.env.development.local',
  '.env.test',
  '.env.test.local',
];
const secret = 'VALORE_FITTIZIO_SOLO_PER_TEST';

function fixture(t: { after: (fn: () => void) => void }): string {
  const dir = mkdtempSync(join(tmpdir(), 'onda-env-test-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

test('ogni variante dotenv segnala la credenziale anche se oscurata da un valore vuoto', (t) => {
  const dir = fixture(t);
  for (const name of variants) {
    writeFileSync(join(dir, name), `EXPO_PUBLIC_JAMENDO_CLIENT_ID="${secret}"\n`);
    const result = readBuildEnvironment(dir, { EXPO_PUBLIC_JAMENDO_CLIENT_ID: '' });
    assert.ok(
      result.credentialErrors.some((error) => error.includes(name)),
      name,
    );
    assert.equal(result.credentialErrors.join('\n').includes(secret), false);
    rmSync(join(dir, name));
  }
});

test('precedenza Expo production e ambiente esplicito, inclusi valori multilinea', (t) => {
  const dir = fixture(t);
  for (const name of ['.env', '.env.production', '.env.local', '.env.production.local']) {
    writeFileSync(join(dir, name), `BUILD_LABEL=${name}\n`);
  }
  writeFileSync(join(dir, '.env.development'), 'BUILD_LABEL=development\n');
  assert.equal(readBuildEnvironment(dir, {}).environment.BUILD_LABEL, '.env.production.local');
  assert.equal(
    readBuildEnvironment(dir, { BUILD_LABEL: 'processo' }).environment.BUILD_LABEL,
    'processo',
  );
  writeFileSync(join(dir, '.env.local'), `EXPO_PUBLIC_API_KEY="\n${secret}\n"\n`);
  assert.ok(
    readBuildEnvironment(dir, {}).credentialErrors.some((error) =>
      error.includes('EXPO_PUBLIC_API_KEY'),
    ),
  );
  const processOnly = readBuildEnvironment(fixture(t), { EXPO_PUBLIC_TOKEN: secret });
  assert.ok(processOnly.credentialErrors.some((error) => error.includes('EXPO_PUBLIC_TOKEN')));
  assert.equal(processOnly.credentialErrors.join('\n').includes(secret), false);
});

test('Git ignora tutte le varianti dotenv senza dover creare file reali nel repository', () => {
  const ignored = spawnSync('git', ['check-ignore', '--no-index', '--stdin'], {
    cwd: root,
    input: variants.join('\n'),
    encoding: 'utf8',
  });
  assert.equal(ignored.status, 0, ignored.stderr);
  assert.deepEqual(ignored.stdout.trim().split(/\r?\n/u), variants);
});

test('doctor rifiuta .env.production in un progetto interamente temporaneo', (t) => {
  const dir = fixture(t);
  mkdirSync(join(dir, 'scripts'));
  for (const file of [
    'personal.ts',
    'personal-policy.ts',
    'release-policy.ts',
    'build-environment.ts',
    'build-provenance.cjs',
  ]) {
    copyFileSync(join(root, 'scripts', file), join(dir, 'scripts', file));
  }
  writeFileSync(join(dir, '.env.production'), `EXPO_PUBLIC_JAMENDO_CLIENT_ID=${secret}\n`);
  const result = spawnSync(
    process.execPath,
    [
      '--experimental-strip-types',
      '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON',
      'scripts/personal.ts',
      'doctor',
    ],
    {
      cwd: dir,
      encoding: 'utf8',
      env: {
        NODE_ENV: 'production',
        PATH: process.env.PATH,
        JAVA_HOME: process.env.JAVA_HOME,
        ANDROID_HOME: process.env.ANDROID_HOME,
      },
    },
  );
  assert.equal(result.status, 1);
  assert.match(result.stdout, /ERRORE\s+Credenziali nel bundle:.*\.env.production/u);
  assert.equal((result.stdout + result.stderr).includes(secret), false);
});

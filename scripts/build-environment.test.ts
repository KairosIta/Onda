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

function personalProject(t: { after: (fn: () => void) => void }): string {
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
  return dir;
}

test('doctor rifiuta .env.production in un progetto interamente temporaneo', (t) => {
  const dir = personalProject(t);
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

test('Gradle riceve il percorso SDK standard o quello esplicito di ANDROID_SDK_ROOT', (t) => {
  const dir = personalProject(t);
  const profile = join(dir, 'Profilo con spazi');
  const standardSdk =
    process.platform === 'darwin'
      ? join(profile, 'Library', 'Android', 'sdk')
      : join(profile, 'Android', 'Sdk');
  const customSdk = join(dir, 'SDK personalizzato');
  const android = join(dir, 'android');
  mkdirSync(android);
  if (process.platform === 'win32') {
    writeFileSync(join(android, 'gradlew.bat'), '@echo SDK=%ANDROID_HOME%\r\n');
  } else {
    writeFileSync(join(android, 'gradlew'), '#!/bin/sh\necho "SDK=$ANDROID_HOME"\n', {
      mode: 0o755,
    });
  }

  // Il wrapper riporta l'ambiente ricevuto da Onda; il test gira senza JDK e SDK installati.
  for (const sdk of [standardSdk, customSdk]) {
    mkdirSync(join(sdk, 'platforms', 'android-36'), { recursive: true });
    mkdirSync(join(sdk, 'build-tools', '36.0.0'), { recursive: true });
    const env: NodeJS.ProcessEnv = {
      NODE_ENV: 'test',
      HOME: profile,
      LOCALAPPDATA: profile,
      PATH: process.env.PATH,
      SystemRoot: process.env.SystemRoot,
    };
    if (sdk === customSdk) env.ANDROID_SDK_ROOT = customSdk;
    const result = spawnSync(
      process.execPath,
      ['--experimental-strip-types', 'scripts/personal.ts', 'android-lint'],
      { cwd: dir, encoding: 'utf8', env },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.ok(result.stdout.split(/\r?\n/u).includes(`SDK=${sdk}`), result.stdout);
  }
});

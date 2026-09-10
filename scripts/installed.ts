/// <reference types="node" />

/**
 * Dice se sul dispositivo collegato c'e' la build che il repository
 * produrrebbe adesso. Nessuna build, nessuna installazione: solo una
 * lettura, cosi' si puo' chiedere prima di decidere se rifare l'APK.
 *
 * Il confronto e' sul nome di versione, perche' e' l'unica cosa che il
 * telefono espone da fuori e che, con `app.config.ts`, porta dentro il
 * commit.
 */

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { compareInstalled, versionName } from './build-provenance.ts';

const root = resolve(import.meta.dirname, '..');

function fail(message: string): never {
  console.error(`\nControllo non eseguito: ${message}`);
  process.exit(1);
}

function git(...args: string[]): string | null {
  try {
    return execFileSync('git', args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
}

function adbPath(): string {
  const home = process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT;
  if (home) {
    for (const name of ['adb', 'adb.exe']) {
      const candidate = join(home, 'platform-tools', name);
      if (existsSync(candidate)) return candidate;
    }
  }
  // Ultima spiaggia: quello nel PATH. Se manca, spawnSync lo dice.
  return 'adb';
}

const appConfig = JSON.parse(readFileSync(join(root, 'app.json'), 'utf8')) as {
  expo: { version: string; android: { package: string; versionCode: number } };
};
const pkg = appConfig.expo.android.package;

const commit = git('rev-parse', 'HEAD');
const status = commit === null ? null : git('status', '--porcelain');
const expected = versionName(appConfig.expo.version, 'personal', {
  commit,
  dirty: Boolean(status && status.length > 0),
});

const adb = adbPath();
const devices = spawnSync(adb, ['devices'], { encoding: 'utf8' });
if (devices.error || devices.status !== 0) {
  fail(`adb non risponde (${adb}). Serve Android SDK platform-tools.`);
}
const attached = (devices.stdout ?? '')
  .split(/\r?\n/u)
  .slice(1)
  .map((line) => line.trim())
  .filter((line) => line.endsWith('device'))
  .map((line) => line.split(/\s+/u)[0]);

if (attached.length === 0) fail('nessun dispositivo autorizzato collegato.');
if (attached.length > 1) {
  fail(`piu' di un dispositivo collegato (${attached.join(', ')}): scollega quelli in eccesso.`);
}

const dump = spawnSync(adb, ['shell', 'dumpsys', 'package', pkg], { encoding: 'utf8' });
const installed = /versionName=(\S+)/u.exec(dump.stdout ?? '')?.[1] ?? null;
const verdict = compareInstalled(installed, expected);

console.log(`\nOnda sul dispositivo ${attached[0]}\n`);
console.log(`  installato : ${verdict.installed ?? '— non installato —'}`);
console.log(`  build ora  : ${verdict.expected}`);

if (verdict.state === 'allineato') {
  console.log('\nAllineato: il telefono ha esattamente questo commit.');
  process.exit(0);
}
if (verdict.state === 'assente') {
  console.log(`\n${pkg} non e' installato. Usa "npm run install:personal".`);
  process.exit(2);
}
console.log('\nDiverso: usa "npm run install:personal" per allineare il telefono.');
process.exit(2);

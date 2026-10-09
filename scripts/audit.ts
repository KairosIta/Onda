/// <reference types="node" />

/**
 * `npm audit` alla soglia alta, con le eccezioni dichiarate in
 * `audit-policy.ts`. E' il controllo che la CI esegue: un avviso nuovo,
 * alto o critico, lo rende rosso come prima.
 */

import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import {
  ACCEPTED_ADVISORIES,
  type Advisory,
  collectAdvisories,
  evaluateAudit,
} from './audit-policy.ts';
import { commandSpec, npmExecutable } from './personal-policy.ts';

const root = resolve(import.meta.dirname, '..');

function fail(message: string): never {
  console.error(`\nControllo dipendenze: ${message}`);
  process.exit(1);
}

const describe = (a: Advisory): string =>
  `${a.severity.padEnd(8)} ${a.packageName} ${a.range} — ${a.title} (${a.id})`;

const spec = commandSpec(npmExecutable());
// `npm audit` esce con un codice diverso da zero appena trova qualcosa,
// anche un avviso moderato: il verdetto lo da' la policy, non il codice.
const result = spawnSync(spec.command, ['audit', '--json'], {
  cwd: root,
  encoding: 'utf8',
  shell: spec.shell,
  maxBuffer: 64 * 1024 * 1024,
});
if (result.error) fail(result.error.message);

let report: unknown;
try {
  report = JSON.parse(result.stdout);
} catch {
  fail(`npm audit non ha prodotto un JSON leggibile.\n${result.stderr || result.stdout}`);
}
if (typeof report === 'object' && report !== null && 'error' in report) {
  fail(`npm audit non e' riuscito: ${JSON.stringify((report as { error: unknown }).error)}`);
}

const today = new Date().toISOString().slice(0, 10);
const verdict = evaluateAudit(collectAdvisories(report), ACCEPTED_ADVISORIES, today);

for (const { advisory, exception } of verdict.accepted) {
  console.log(`accettato fino al ${exception.reviewBy}: ${describe(advisory)}`);
}
for (const exception of verdict.expired) {
  console.error(
    `eccezione scaduta il ${exception.reviewBy}: ${exception.packageName} (${exception.id}). ` +
      'Controlla se esiste una versione corretta; se no, riscrivi il motivo e sposta la data.',
  );
}
for (const exception of verdict.unused) {
  console.error(
    `eccezione non piu' necessaria: ${exception.packageName} (${exception.id}). ` +
      'Toglila da scripts/audit-policy.ts.',
  );
}
for (const advisory of verdict.blocking) console.error(`bloccante: ${describe(advisory)}`);

if (!verdict.ok) fail('ci sono avvisi alti o critici da risolvere.');
console.log(
  `\nNessun avviso alto o critico scoperto (${verdict.accepted.length} accettati per scritto).`,
);

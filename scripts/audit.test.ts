/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ACCEPTED_ADVISORIES,
  type AcceptedAdvisory,
  type Advisory,
  collectAdvisories,
  evaluateAudit,
} from './audit-policy.ts';

/** Forma ridotta ma fedele di `npm audit --json` (auditReportVersion 2). */
const report = {
  auditReportVersion: 2,
  vulnerabilities: {
    braces: {
      name: 'braces',
      severity: 'high',
      via: [
        {
          source: 1,
          name: 'braces',
          title: 'stack exhaustion',
          url: 'https://github.com/advisories/GHSA-vfj7-8cjw-p6xm',
          severity: 'high',
          range: '<=3.0.3',
        },
      ],
    },
    // Un pacchetto che e' vulnerabile solo perche' dipende da braces: la
    // stringa in `via` non e' un avviso nuovo.
    micromatch: { name: 'micromatch', severity: 'high', via: ['braces'] },
    'brace-expansion': {
      name: 'brace-expansion',
      severity: 'high',
      via: [
        // Lo stesso avviso su due linee di major: una voce sola.
        {
          source: 2,
          name: 'brace-expansion',
          title: 'quadratic expansion',
          url: 'https://github.com/advisories/GHSA-q2hr-2g5m-vwhr',
          severity: 'high',
          range: '<1.1.21',
        },
        {
          source: 3,
          name: 'brace-expansion',
          title: 'quadratic expansion',
          url: 'https://github.com/advisories/GHSA-q2hr-2g5m-vwhr',
          severity: 'high',
          range: '>=4.0.0 <5.0.12',
        },
      ],
    },
    'decode-uri-component': {
      name: 'decode-uri-component',
      severity: 'moderate',
      via: [
        {
          source: 4,
          name: 'decode-uri-component',
          title: 'malformed input',
          url: 'https://github.com/advisories/GHSA-vcc3-ghjq-m6fr',
          severity: 'moderate',
          range: '<=0.4.2',
        },
      ],
    },
  },
};

const advisory = (over: Partial<Advisory> = {}): Advisory => ({
  id: 'GHSA-aaaa-bbbb-cccc',
  packageName: 'pacchetto',
  severity: 'high',
  title: 'titolo',
  range: '*',
  ...over,
});

const exception = (over: Partial<AcceptedAdvisory> = {}): AcceptedAdvisory => ({
  id: 'GHSA-aaaa-bbbb-cccc',
  packageName: 'pacchetto',
  reviewBy: '2026-12-31',
  reason: 'nessuna versione corretta',
  ...over,
});

test('audit: dal rapporto restano gli avvisi veri, una voce per avviso e pacchetto', () => {
  const found = collectAdvisories(report);
  assert.deepEqual(found.map((a) => `${a.packageName} ${a.id} ${a.severity}`).sort(), [
    'brace-expansion GHSA-q2hr-2g5m-vwhr high',
    'braces GHSA-vfj7-8cjw-p6xm high',
    'decode-uri-component GHSA-vcc3-ghjq-m6fr moderate',
  ]);
  // Un rapporto senza la forma attesa non e' un "tutto pulito".
  assert.throws(() => collectAdvisories({ error: { code: 'ENOTFOUND' } }));
  assert.deepEqual(collectAdvisories({ vulnerabilities: {} }), []);
});

test('audit: un avviso alto senza eccezione blocca, uno moderato no', () => {
  const verdict = evaluateAudit(
    [advisory(), advisory({ id: 'GHSA-mmmm-mmmm-mmmm', severity: 'moderate' })],
    [],
    '2026-10-09',
  );
  assert.equal(verdict.ok, false);
  assert.deepEqual(
    verdict.blocking.map((a) => a.id),
    ['GHSA-aaaa-bbbb-cccc'],
  );
  // Severita' critica: stessa regola.
  assert.equal(evaluateAudit([advisory({ severity: 'critical' })], [], '2026-10-09').ok, false);
  assert.equal(evaluateAudit([], [], '2026-10-09').ok, true);
});

test("audit: un'eccezione valida accetta solo il suo avviso sul suo pacchetto", () => {
  const verdict = evaluateAudit([advisory()], [exception()], '2026-10-09');
  assert.equal(verdict.ok, true);
  assert.equal(verdict.accepted.length, 1);

  // Stesso avviso su un altro pacchetto: l'eccezione non lo copre.
  const other = evaluateAudit(
    [advisory(), advisory({ packageName: 'altro' })],
    [exception()],
    '2026-10-09',
  );
  assert.equal(other.ok, false);
  assert.deepEqual(
    other.blocking.map((a) => a.packageName),
    ['altro'],
  );
});

test("audit: un'eccezione vale fino al giorno indicato compreso, poi blocca di nuovo", () => {
  assert.equal(evaluateAudit([advisory()], [exception()], '2026-12-31').ok, true);
  const late = evaluateAudit([advisory()], [exception()], '2027-01-01');
  assert.equal(late.ok, false);
  assert.equal(late.blocking.length, 1);
  assert.equal(late.expired.length, 1);
});

test("audit: un'eccezione rimasta senza avviso fa fallire finche' non la si toglie", () => {
  const verdict = evaluateAudit([], [exception()], '2026-10-09');
  assert.equal(verdict.ok, false);
  assert.equal(verdict.unused.length, 1);
  // Un avviso sceso a moderato non giustifica piu' un'eccezione.
  assert.equal(
    evaluateAudit([advisory({ severity: 'moderate' })], [exception()], '2026-10-09').unused.length,
    1,
  );
});

test('audit: le eccezioni dichiarate sono complete e ben formate', () => {
  const seen = new Set<string>();
  for (const e of ACCEPTED_ADVISORIES) {
    assert.match(e.id, /^GHSA(-[0-9a-z]{4}){3}$/u, e.id);
    assert.match(e.reviewBy, /^\d{4}-\d{2}-\d{2}$/u, e.reviewBy);
    assert.equal(Number.isNaN(Date.parse(e.reviewBy)), false, e.reviewBy);
    assert.ok(e.packageName.length > 0);
    assert.ok(e.reason.length > 40, `motivo troppo vago per ${e.packageName}`);
    const key = `${e.packageName}|${e.id}`;
    assert.equal(seen.has(key), false, `eccezione doppia: ${key}`);
    seen.add(key);
  }
});

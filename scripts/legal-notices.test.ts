/// <reference types="node" />

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  describeKinds,
  describeLicenses,
  describeOrigin,
  licenseLabel,
  parseComponentIndex,
  reflowLicenseText,
  sectionsByKind,
  textsOf,
  type NoticeComponent,
  type NoticesFile,
} from '@/legal/notices';

// Il file committato, come lo incorpora l'app: cosi' i test dicono se la
// schermata lo legge tutto, non solo se le funzioni tornano su un esempio.
const file = JSON.parse(
  readFileSync(new URL('../assets/legal/third-party-notices.json', import.meta.url), 'utf8'),
) as NoticesFile;

const component = (partial: Partial<NoticeComponent>): NoticeComponent => ({
  kind: 'npm',
  name: 'x',
  license: 'MIT',
  texts: [],
  ...partial,
});

test('la schermata legge tutto il file committato: ogni componente in una sezione, ogni testo presente', () => {
  assert.equal(file.schema, 1);
  const sections = sectionsByKind(file);
  assert.deepEqual(
    sections.map((s) => s.kind),
    ['android', 'npm', 'font'],
  );
  const listed = sections.reduce((n, s) => n + s.data.length, 0);
  assert.equal(listed, file.components.length);
  assert.equal(listed, file.summary.components);
  for (const section of sections) {
    assert.equal(section.data.length, file.summary.byKind[section.kind]);
  }
  for (const entry of file.components) {
    const texts = textsOf(file, entry);
    assert.equal(
      texts.length,
      entry.texts.length + (entry.notices?.length ?? 0),
      `${entry.name}: ogni id di testo si risolve`,
    );
    assert.ok(
      texts.every((t) => t.text.trim().length > 0),
      `${entry.name}: nessun testo vuoto`,
    );
    assert.ok(
      texts.some((t) => t.role === 'license'),
      `${entry.name}: ha un testo di licenza`,
    );
  }
});

test('il testo della licenza Apache 2.0 di Media3 e le NOTICE sono nel file, per esteso', () => {
  const media3 = file.components.find((c) => c.name === 'androidx.media3:media3-exoplayer');
  assert.ok(media3, 'Media3 ExoPlayer e’ fra i componenti');
  assert.equal(media3.license, 'Apache-2.0');
  const [apache] = textsOf(file, media3);
  assert.ok(apache);
  assert.ok(apache.text.trimStart().startsWith('Apache License'));
  assert.ok(apache.text.includes('Version 2.0, January 2004'));
  assert.ok(apache.text.includes('TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION'));

  const codec = file.components.find((c) => c.name === 'commons-codec:commons-codec');
  assert.ok(codec);
  assert.deepEqual(
    textsOf(file, codec).map((t) => t.role),
    ['license', 'notice'],
  );
});

test('la route di dettaglio apre solo una posizione esistente del file', () => {
  const last = file.components.length - 1;
  assert.equal(parseComponentIndex('0', file)?.component, file.components[0]);
  assert.equal(parseComponentIndex(String(last), file)?.index, last);
  for (const bad of [undefined, [], ['1'], '', ' 1', 'x', '-1', '1.5', '1e2', String(last + 1)]) {
    assert.equal(parseComponentIndex(bad, file), null, JSON.stringify(bad));
  }
});

test('le licenze si leggono per esteso, anche nelle espressioni composte', () => {
  assert.equal(licenseLabel('Apache-2.0'), 'Apache 2.0');
  assert.equal(licenseLabel('MIT'), 'MIT');
  assert.equal(licenseLabel('ISC'), 'ISC');
  assert.equal(licenseLabel('OFL-1.1'), 'OFL 1.1');
  assert.equal(licenseLabel('(MIT AND BSD-3-Clause)'), 'MIT e BSD 3-Clause');
  assert.equal(licenseLabel('MIT AND Apache-2.0'), 'MIT e Apache 2.0');
  assert.equal(licenseLabel('Apache-2.0 AND BSD-2-Clause'), 'Apache 2.0 e BSD 2-Clause');
});

test('il riepilogo conta per tipo e per licenza, dalla piu’ usata', () => {
  const small: NoticesFile = {
    schema: 1,
    summary: {
      components: 4,
      byKind: { android: 2, npm: 1, font: 1 },
      byLicense: { MIT: 1, 'Apache-2.0': 3 },
    },
    licenses: {},
    components: [],
  };
  assert.equal(describeKinds(small), '4 componenti: 2 librerie Android, 1 pacchetto npm e 1 font');
  assert.equal(describeLicenses(small), '3 Apache 2.0, 1 MIT');
  assert.equal(
    describeKinds({ ...small, summary: { components: 1, byKind: { font: 1 }, byLicense: {} } }),
    '1 componente: 1 font',
  );
  assert.ok(describeKinds(file).startsWith(`${file.summary.components} componenti: `));
});

test('la scheda dice dove il componente entra nell’APK', () => {
  assert.equal(describeOrigin(component({ scopes: ['js'] })), 'Nel bundle JavaScript');
  assert.equal(
    describeOrigin(component({ scopes: ['android'] })),
    'Modulo nativo Android, compilato durante la build',
  );
  assert.equal(
    describeOrigin(component({ scopes: ['android', 'js'] })),
    'Nel bundle JavaScript e come modulo nativo Android',
  );
  assert.equal(
    describeOrigin(component({ kind: 'font', via: '@expo/vector-icons' })),
    'Font incorporato da @expo/vector-icons',
  );
  assert.match(describeOrigin(component({ kind: 'android' })), /^Libreria Android/);
});

test('i testi di licenza si ricompongono per paragrafo, senza toccare titoli ed elenchi', () => {
  const apache = textsOf(
    file,
    file.components.find((c) => c.name === 'androidx.media3:media3-exoplayer')!,
  )[0]!.text;
  const flowed = reflowLicenseText(apache);
  assert.ok(
    flowed.startsWith('Apache License\nVersion 2.0, January 2004\nhttp://www.apache.org/licenses/'),
    'il blocco del titolo resta su tre righe, senza rientri',
  );
  assert.ok(
    flowed.includes(
      '"Work" shall mean the work of authorship, whether in Source or Object form, made available under the License,',
    ),
    'le righe di un paragrafo tornano un flusso unico',
  );
  assert.ok(!/^[ \t]/m.test(flowed), 'nessuna riga comincia con uno spazio');
  assert.ok(flowed.includes('\n\n1. Definitions.\n\n'), 'i paragrafi restano separati');
  assert.equal(
    flowed.split(/\s+/).join(' '),
    apache.trim().split(/\s+/).join(' '),
    'le parole sono le stesse',
  );

  assert.equal(
    reflowLicenseText(
      'Redistribution and use are permitted provided that the following conditions are met:\n' +
        '1. Redistributions of source code must retain the above copyright notice, this\n' +
        '   list of conditions and the following disclaimer.\n' +
        '2. Redistributions in binary form must reproduce the above copyright notice.\n',
    ),
    'Redistribution and use are permitted provided that the following conditions are met:\n' +
      '1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.\n' +
      '2. Redistributions in binary form must reproduce the above copyright notice.',
  );
  assert.equal(
    reflowLicenseText(
      'Apache Commons Codec\r\nCopyright 2002-2014 The Apache Software Foundation\r\n\r\n',
    ),
    'Apache Commons Codec\nCopyright 2002-2014 The Apache Software Foundation',
    'un blocco di righe corte resta com\u2019era, anche con i fine riga di Windows',
  );
});

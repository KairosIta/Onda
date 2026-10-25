/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildNotices,
  compareNotices,
  copyrightLine,
  normalizeText,
  packageFromPath,
  parsePom,
  renderNotices,
  spdxFromPom,
  textId,
  type BuildInput,
  type Component,
  type Notices,
} from './notices-core.ts';

const APACHE =
  'Apache License\nVersion 2.0, January 2004\n\nTERMS AND CONDITIONS\n\nAPPENDIX\n\nCopyright [yyyy] [name of copyright owner]\n';
const mit = (holder: string): string =>
  `MIT License\n\nCopyright (c) ${holder}\n\nPermission is hereby granted, free of charge...\n\nThe above copyright notice shall be included.\n`;
const pom = (inner: string): string =>
  `<?xml version="1.0"?>\n<project xmlns="http://maven.apache.org/POM/4.0.0">\n<modelVersion>4.0.0</modelVersion>\n${inner}\n</project>\n`;

const apachePom = pom(
  '<licenses><license><name>Apache License, Version 2.0</name><url>http://www.apache.org/licenses/LICENSE-2.0.txt</url></license></licenses>' +
    '<developers><developer><name>The Android Open Source Project</name></developer></developers>',
);
const mitPom = pom(
  '<url>https://github.com/facebook/fresco</url>' +
    '<licenses><license><name>MIT</name><url>https://github.com/facebook/fresco/blob/main/LICENSE</url></license></licenses>',
);

const input = (partial: Partial<BuildInput> = {}): BuildInput => ({
  npm: [],
  maven: [],
  overrides: {},
  textFiles: { 'texts/Apache-2.0.txt': APACHE },
  ...partial,
});

test('parsePom legge licenze, genitore, titolare e url del progetto, non quelli annidati o commentati', () => {
  const info = parsePom(
    pom(`<!-- <licenses><license><name>Finta</name></license></licenses> -->
    <parent><groupId>org.example</groupId><artifactId>parent</artifactId><version>1</version></parent>
    <artifactId>lib</artifactId><name>Lib &amp; Co</name><url>https://example.test/lib</url>
    <organization><name>Example Org</name><url>https://example.test</url></organization>
    <licenses><license><name>The Apache Software License, Version 2.0</name><url>http://www.apache.org/licenses/LICENSE-2.0.txt</url></license></licenses>
    <developers><developer><id>dev</id><name>Dev One</name><url>https://example.test/dev</url></developer></developers>
    <scm><url>https://scm.example.test</url></scm>`),
  );
  assert.equal(info.name, 'Lib & Co');
  assert.equal(info.url, 'https://example.test/lib');
  assert.equal(info.organization, 'Example Org');
  assert.deepEqual(info.developers, ['Dev One']);
  assert.deepEqual(info.licenses, [
    {
      name: 'The Apache Software License, Version 2.0',
      url: 'http://www.apache.org/licenses/LICENSE-2.0.txt',
    },
  ]);
  assert.deepEqual(info.parent, { groupId: 'org.example', artifactId: 'parent', version: '1' });

  const bare = parsePom(pom('<artifactId>x</artifactId>'));
  assert.deepEqual(bare.licenses, []);
  assert.equal(bare.parent, undefined);
  assert.equal(bare.name, undefined);
});

test('spdxFromPom riconosce le grafie correnti e lascia indecise le altre', () => {
  const cases: [string, string, string | undefined][] = [
    [
      'The Apache Software License, Version 2.0',
      'http://www.apache.org/licenses/LICENSE-2.0.txt',
      'Apache-2.0',
    ],
    ['Apache-2', 'https://github.com/facebook/soloader/blob/main/LICENSE', 'Apache-2.0'],
    ['APACHE-2', '', 'Apache-2.0'],
    ['MIT License', 'https://github.com/react/react-native/blob/HEAD/LICENSE', 'MIT'],
    ['The MIT License', 'https://opensource.org/license/mit', 'MIT'],
    ['MIT', '', 'MIT'],
    ['Simplified BSD License', 'http://www.opensource.org/licenses/bsd-license', 'BSD-2-Clause'],
    ['BSD 2-Clause License', '', 'BSD-2-Clause'],
    ['New BSD License', '', 'BSD-3-Clause'],
    [
      'BSD License',
      'https://github.com/BoltsFramework/Bolts-Android/blob/master/LICENSE',
      undefined,
    ],
    ['Eclipse Public License 2.0', '', undefined],
  ];
  for (const [name, url, expected] of cases)
    assert.equal(spdxFromPom({ name, url }), expected, name);
});

test("packageFromPath trova il pacchetto dall'ultimo node_modules, con scope e con i percorsi Windows", () => {
  assert.deepEqual(packageFromPath('/r/node_modules/expo/node_modules/@expo/cli/build/x.js'), {
    name: '@expo/cli',
    dir: '/r/node_modules/expo/node_modules/@expo/cli',
  });
  assert.deepEqual(
    packageFromPath('/r/node_modules/expo-file-system/local-maven-repo/host/exp/exponent/x.aar'),
    { name: 'expo-file-system', dir: '/r/node_modules/expo-file-system' },
  );
  assert.deepEqual(packageFromPath('C:\\r\\node_modules\\react-native-screens\\android'), {
    name: 'react-native-screens',
    dir: 'C:/r/node_modules/react-native-screens',
  });
  assert.equal(packageFromPath('/r/modules/onda-player/android'), undefined);
  assert.equal(packageFromPath('/r/node_modules/@scope'), undefined);
});

test('normalizeText e textId ignorano fine riga, BOM e spazi finali', () => {
  assert.equal(textId('a  \r\nb\r\n'), textId('a\nb'));
  assert.equal(normalizeText('\uFEFFx \n\n'), 'x\n');
});

test('copyrightLine prende la riga del titolare, non la clausola che cita il copyright', () => {
  assert.equal(copyrightLine(mit('2024 Marc Rousavy')), 'Copyright (c) 2024 Marc Rousavy');
  assert.equal(copyrightLine('The above copyright notice shall be included.\n'), undefined);
  assert.equal(copyrightLine('  (c) Copyright 2001 X\n'), '(c) Copyright 2001 X');
});

const fixture = (): BuildInput =>
  input({
    npm: [
      {
        name: 'react-native',
        version: '0.86.3',
        license: 'MIT',
        texts: [{ file: 'LICENSE', text: mit('Meta Platforms, Inc. and affiliates.') }],
        scopes: ['js'],
      },
      {
        name: '@react-native/js-polyfills',
        version: '0.86.3',
        license: 'MIT',
        texts: [],
        scopes: ['js'],
      },
      {
        name: 'expo-file-system',
        version: '57.0.7',
        license: 'MIT',
        author: 'Expo',
        texts: [{ file: 'LICENSE', text: mit('650 Industries') }],
        scopes: ['js', 'android'],
      },
    ],
    maven: [
      {
        group: 'androidx.media3',
        name: 'media3-exoplayer',
        version: '1.11.1',
        poms: [apachePom],
        notices: [],
      },
      {
        group: 'commons-codec',
        name: 'commons-codec',
        version: '1.10',
        poms: [
          pom(
            '<parent><groupId>org.apache</groupId><artifactId>p</artifactId><version>1</version></parent>',
          ),
          apachePom,
        ],
        notices: [
          {
            path: 'META-INF/NOTICE.txt',
            text: 'Apache Commons Codec\nCopyright 2002-2014 The Apache Software Foundation\n',
          },
          { path: 'META-INF/LICENSE.txt', text: APACHE },
        ],
      },
      {
        group: 'com.facebook.fresco',
        name: 'fresco',
        version: '3.6.0',
        poms: [mitPom],
        notices: [],
      },
    ],
    overrides: {
      packages: { '@react-native/js-polyfills': { textFrom: 'react-native' } },
      artifacts: { 'com.facebook.fresco': { textPath: 'texts/fresco.txt' } },
      fonts: [
        {
          name: 'Ionicons',
          via: '@expo/vector-icons',
          license: 'MIT',
          textPath: 'texts/ionicons.txt',
        },
      ],
    },
    textFiles: {
      'texts/Apache-2.0.txt': APACHE,
      'texts/fresco.txt': mit('Meta Platforms, Inc. and affiliates.'),
      'texts/ionicons.txt': mit('2015-present Ionic'),
    },
  });

test('buildNotices: Apache dal testo canonico con la NOTICE a parte, MIT dal pacchetto, testi deduplicati, ordine fisso', () => {
  const notices = buildNotices(fixture());
  assert.deepEqual(
    notices.components.map((component) => `${component.kind} ${component.name}`),
    [
      'android androidx.media3:media3-exoplayer',
      'android com.facebook.fresco:fresco',
      'android commons-codec:commons-codec',
      'npm @react-native/js-polyfills',
      'npm expo-file-system',
      'npm react-native',
      'font Ionicons',
    ],
  );
  const byName = Object.fromEntries(
    notices.components.map((component) => [component.name, component]),
  );
  const media3 = byName['androidx.media3:media3-exoplayer'];
  assert.equal(media3.holder, 'The Android Open Source Project');
  assert.deepEqual(media3.texts, [textId(APACHE)]);
  assert.equal(media3.notices, undefined);
  const codec = byName['commons-codec:commons-codec'];
  assert.deepEqual(codec.texts, [textId(APACHE)]);
  assert.equal(codec.holder, 'Copyright 2002-2014 The Apache Software Foundation');
  assert.equal(codec.notices?.length, 1);
  // Lo stesso testo MIT, da override o dal pacchetto, ha un solo id.
  assert.deepEqual(byName['com.facebook.fresco:fresco'].texts, byName['react-native'].texts);
  assert.equal(byName['com.facebook.fresco:fresco'].url, 'https://github.com/facebook/fresco');
  assert.deepEqual(byName['@react-native/js-polyfills'].texts, byName['react-native'].texts);
  assert.deepEqual(byName['expo-file-system'].scopes, ['android', 'js']);
  assert.equal(byName['Ionicons'].holder, 'Copyright (c) 2015-present Ionic');
  assert.equal(byName['Ionicons'].via, '@expo/vector-icons');
  // Apache, due MIT diversi, Ionicons e la NOTICE: anche gli avvisi stanno fra i testi.
  assert.equal(Object.keys(notices.licenses).length, 5);
  assert.deepEqual(notices.summary, {
    components: 7,
    byKind: { android: 3, font: 1, npm: 3 },
    byLicense: { 'Apache-2.0': 2, MIT: 5 },
  });

  const rendered = renderNotices(notices);
  assert.equal(rendered, renderNotices(buildNotices(fixture())), 'identico a parita di input');
  assert.ok(rendered.endsWith('}\n'));
  assert.equal(
    Object.keys((JSON.parse(rendered) as Notices).components[0]).join(),
    'kind,name,version,license,holder,texts',
  );
});

test('buildNotices si ferma ed elenca ogni caso da decidere, compresi gli override inutili', () => {
  assert.throws(
    () =>
      buildNotices(
        input({
          npm: [{ name: 'no-license', version: '1.0.0', texts: [], scopes: ['js'] }],
          maven: [
            {
              group: 'com.parse.bolts',
              name: 'bolts-tasks',
              version: '1.4.0',
              poms: [
                pom('<licenses><license><name>BSD License</name><url>u</url></license></licenses>'),
              ],
              notices: [],
            },
            { group: 'org.x', name: 'nopom', version: '1', poms: [], notices: [] },
            { group: 'org.y', name: 'mit-no-text', version: '1', poms: [mitPom], notices: [] },
          ],
          overrides: { packages: { unused: { license: 'MIT' } } },
        }),
      ),
    (error: Error) => {
      const lines = error.message.split('\n');
      const expected = [
        'no-license@1.0.0: package.json non dichiara',
        'no-license@1.0.0: nessun file LICENSE',
        'com.parse.bolts:bolts-tasks:1.4.0: licenza non riconosciuta',
        'org.x:nopom:1: nessun POM',
        'org.y:mit-no-text:1: licenza MIT senza testo',
        'override packages.unused non corrisponde',
      ];
      for (const prefix of expected) {
        assert.ok(
          lines.some((line) => line.startsWith(prefix)),
          `manca: ${prefix}\n${error.message}`,
        );
      }
      assert.equal(lines.length, expected.length);
      return true;
    },
  );
});

test("l'override dell'artefatto vince su quello del gruppo; due licenze nel POM diventano un AND", () => {
  const dual = pom(
    '<licenses><license><name>Simplified BSD License</name><url>u</url></license>' +
      '<license><name>Apache License, Version 2.0</name><url>u</url></license></licenses>',
  );
  const notices = buildNotices(
    input({
      maven: [
        {
          group: 'com.github.bumptech.glide',
          name: 'glide',
          version: '5.0.5',
          poms: [dual],
          notices: [],
        },
        {
          group: 'com.github.bumptech.glide',
          name: 'annotations',
          version: '5.0.5',
          poms: [dual],
          notices: [],
        },
        {
          group: 'com.parse.bolts',
          name: 'bolts-tasks',
          version: '1.4.0',
          poms: [
            pom('<licenses><license><name>BSD License</name><url>u</url></license></licenses>'),
          ],
          notices: [],
        },
      ],
      overrides: {
        artifacts: {
          'com.github.bumptech.glide': { textPath: 'texts/glide.txt' },
          'com.github.bumptech.glide:annotations': { license: 'MIT', textPath: 'texts/glide.txt' },
          'com.parse.bolts': { license: 'BSD-3-Clause', textPath: 'texts/bolts.txt' },
        },
      },
      textFiles: {
        'texts/Apache-2.0.txt': APACHE,
        'texts/glide.txt': 'Copyright 2014 Google, Inc.\nBSD...\n',
        'texts/bolts.txt':
          'BSD License\n\nFor Bolts software\n\nCopyright (c) 2013-present, Facebook, Inc.\n',
      },
    }),
  );
  const [annotations, glide, bolts] = notices.components;
  assert.equal(annotations.name, 'com.github.bumptech.glide:annotations');
  assert.equal(annotations.license, 'MIT');
  assert.equal(glide.license, 'Apache-2.0 AND BSD-2-Clause');
  assert.equal(glide.holder, 'Copyright 2014 Google, Inc.');
  assert.equal(bolts.license, 'BSD-3-Clause');
  assert.equal(bolts.holder, 'Copyright (c) 2013-present, Facebook, Inc.');
});

test('compareNotices racconta nuovi, rimossi, versioni e testi cambiati', () => {
  const make = (components: Component[]): Notices => ({
    schema: 1,
    summary: { components: components.length, byKind: {}, byLicense: {} },
    licenses: {},
    components,
  });
  const before = make([
    { kind: 'npm', name: 'a', version: '1', license: 'MIT', texts: ['x'] },
    { kind: 'npm', name: 'b', version: '1', license: 'MIT', texts: ['x'] },
    { kind: 'android', name: 'g:c', version: '1', license: 'MIT', texts: ['x'] },
  ]);
  const after = make([
    { kind: 'npm', name: 'a', version: '2', license: 'MIT', texts: ['x'] },
    { kind: 'android', name: 'g:c', version: '1', license: 'MIT', texts: ['y'] },
    { kind: 'font', name: 'F', license: 'OFL-1.1', texts: ['z'] },
  ]);
  assert.deepEqual(compareNotices(before, after), [
    'licenza o testo cambiati: android g:c',
    'nuovo: font F  (OFL-1.1)',
    'rimosso: npm b',
    'versione: npm a 1 -> 2',
  ]);
  assert.deepEqual(compareNotices(before, before), [
    'stessi componenti, ma file diverso: rigeneralo.',
  ]);
});

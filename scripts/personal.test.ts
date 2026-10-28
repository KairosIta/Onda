/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  androidExecutable,
  androidSdkCandidates,
  apksignerExecutable,
  checkNodeVersion,
  commandSpec,
  gradleWrapper,
  isVersionAtLeast,
  npmExecutable,
  parseJavaMajor,
  quoteForCmd,
} from './personal-policy.ts';

test('il requisito Node distingue versioni supportate e obsolete', () => {
  assert.equal(isVersionAtLeast('22.15.0', [22, 15, 0]), true);
  assert.equal(isVersionAtLeast('24.0.0', [22, 15, 0]), true);
  assert.equal(isVersionAtLeast('22.14.9', [22, 15, 0]), false);
  assert.equal(checkNodeVersion('20.19.0').supported, false);
});

test('la versione Java viene letta dai formati OpenJDK comuni', () => {
  assert.equal(parseJavaMajor('openjdk version "17.0.12" 2024-07-16'), 17);
  assert.equal(parseJavaMajor('java version "1.8.0_402"'), 8);
  assert.equal(parseJavaMajor('comando assente'), undefined);
});

test('i comandi Windows usano wrapper ed eseguibili nativi', () => {
  assert.equal(npmExecutable('win32'), 'npm.cmd');
  assert.equal(gradleWrapper('C:\\repo', 'win32'), 'C:\\repo\\android\\gradlew.bat');
  assert.equal(androidExecutable('adb', 'win32'), 'adb.exe');
  assert.equal(apksignerExecutable('win32'), 'apksigner.bat');
  assert.deepEqual(commandSpec('gradlew.bat', ['assembleRelease'], 'win32'), {
    command: 'gradlew.bat assembleRelease',
    args: [],
    shell: true,
  });
  assert.deepEqual(commandSpec('java', ['-version'], 'win32'), {
    command: 'java',
    args: ['-version'],
    shell: false,
  });
  assert.deepEqual(commandSpec('gradlew.bat', ['x'], 'linux'), {
    command: 'gradlew.bat',
    args: ['x'],
    shell: false,
  });
});

test('su Windows i percorsi con spazi restano un solo argomento per cmd.exe', () => {
  const wrapper = 'C:\\Users\\Mario Rossi\\Onda\\android\\gradlew.bat';
  assert.deepEqual(
    commandSpec(wrapper, ['assembleRelease', '-PondaNoticesOut=C:\\Temp\\onda notices'], 'win32'),
    {
      command: `"${wrapper}" assembleRelease "-PondaNoticesOut=C:\\Temp\\onda notices"`,
      args: [],
      shell: true,
    },
  );
  assert.equal(quoteForCmd('verify'), 'verify');
  assert.equal(quoteForCmd('a&b'), '"a&b"');
  assert.equal(quoteForCmd('100%'), '"100%"');
  assert.equal(quoteForCmd(''), '""');
  assert.throws(() => quoteForCmd('con "virgolette"'), /non rappresentabile/u);
  assert.throws(() => quoteForCmd('a\nb'), /non rappresentabile/u);
});

test('la ricerca SDK privilegia le variabili esplicite e copre Windows', () => {
  assert.deepEqual(
    androidSdkCandidates(
      {
        ANDROID_HOME: 'D:\\Sdk',
        LOCALAPPDATA: 'C:\\Users\\Ada\\AppData\\Local',
        NODE_ENV: 'test',
      },
      'win32',
    ),
    ['D:\\Sdk', 'C:\\Users\\Ada\\AppData\\Local\\Android\\Sdk'],
  );
});

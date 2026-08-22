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
  assert.deepEqual(commandSpec('gradlew.bat', 'win32'), { command: 'gradlew.bat', shell: true });
  assert.deepEqual(commandSpec('java', 'win32'), { command: 'java', shell: false });
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

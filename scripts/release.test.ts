/// <reference types="node" />

import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
import {
  normalizeCertificateSha256,
  parseKeyValueFile,
  resolveReleaseEnvironment,
  validateJamendoClientId,
  validateReleaseIdentity,
  validateSigningProperties,
} from './release-policy.ts';

const require = createRequire(import.meta.url);
const signingPlugin = require('../plugins/with-release-signing.js') as {
  patch: (contents: string) => string;
};
const qualityPlugin = require('../plugins/with-android-quality.js') as {
  patchSplashStyles: (contents: string) => string;
};
const privacyPlugin = require('../plugins/with-android-privacy.js') as {
  DOMAINS: string[];
  FULL_BACKUP_CONTENT: string;
  DATA_EXTRACTION_RULES: string;
};
const appConfig = require('../app.json') as {
  expo: { backgroundColor?: string; plugins?: unknown[] };
};

test('il parser legge .env e properties senza includere commenti', () => {
  assert.deepEqual(parseKeyValueFile(`\n# commento\nA=uno\nexport B="due"\nC=tre # nota\n`), {
    A: 'uno',
    B: 'due',
    C: 'tre',
  });
});

test('l ambiente esplicito prevale sul file e forza production', () => {
  const resolved = resolveReleaseEnvironment(
    { EXPO_PUBLIC_JAMENDO_CLIENT_ID: 'file', NODE_ENV: 'development' },
    { EXPO_PUBLIC_JAMENDO_CLIENT_ID: 'processo' },
  );
  assert.equal(resolved.EXPO_PUBLIC_JAMENDO_CLIENT_ID, 'processo');
  assert.equal(resolved.NODE_ENV, 'production');
});

test('il Client ID Jamendo e obbligatorio e non puo essere un placeholder', () => {
  assert.equal(validateJamendoClientId(undefined).length, 1);
  assert.equal(validateJamendoClientId('inserisci_il_tuo_client_id').length, 1);
  assert.deepEqual(validateJamendoClientId('client-id-reale'), []);
});

test('le credenziali richiedono tutte le proprieta e un percorso interno', () => {
  assert.deepEqual(
    validateSigningProperties(
      {
        storeFile: 'onda-release.keystore',
        storePassword: 'secret',
        keyAlias: 'onda',
        keyPassword: 'secret',
      },
      '/repo/credentials',
    ),
    [],
  );
  assert.equal(
    validateSigningProperties({ storeFile: '../debug.keystore' }, '/repo/credentials').length,
    2,
  );
});

test("l'identita di release blocca package o certificati inattesi", () => {
  const digest =
    '89:D6:4B:A9:4F:CB:05:BC:B2:7F:1D:38:4D:B4:B7:A0:32:89:19:6A:7D:6C:1C:E2:48:88:C5:59:9A:5F:32:A8';
  assert.equal(
    normalizeCertificateSha256(digest),
    '89d64ba94fcb05bcb27f1d384db4b7a03289196a7d6c1ce24888c5599a5f32a8',
  );
  assert.deepEqual(
    validateReleaseIdentity(
      { package: 'com.onda.player', certificateSha256: digest },
      'com.onda.player',
    ),
    [],
  );
  assert.equal(
    validateReleaseIdentity(
      { package: 'com.example.onda', certificateSha256: 'non-valida' },
      'com.onda.player',
    ).length,
    2,
  );
});

test('il plugin non usa implicitamente la debug key per una release', () => {
  const fixture = `android {\n    signingConfigs {\n        debug {\n            keyPassword 'android'\n        }\n    }\n    buildTypes {\n        release {\n            // Caution! In production, you need to generate your own keystore file.\n            // see https://reactnative.dev/docs/signed-apk-android.\n            signingConfig signingConfigs.debug\n        }\n    }\n}\n`;
  const patched = signingPlugin.patch(fixture);
  assert.match(patched, /ONDA_ALLOW_DEBUG_RELEASE/u);
  assert.match(patched, /ONDA_FORCE_DEBUG_RELEASE/u);
  assert.match(patched, /ondaKeystoreProps[.]isFile\(\) && !ondaForceDebugRelease/u);
  assert.match(patched, /release bloccata/u);
  assert.match(patched, /ondaAllowDebugRelease \? signingConfigs\.debug : null/u);
});

test('il comportamento splash Android 13 resta esplicitamente limitato alla sua API', () => {
  const patched = qualityPlugin.patchSplashStyles(
    '<item name="android:windowSplashScreenBehavior">icon_preferred</item>',
  );

  assert.equal(
    patched,
    '<item name="android:windowSplashScreenBehavior" tools:targetApi="33">icon_preferred</item>',
  );
});

test('le regole Android escludono ogni dominio da cloud e trasferimento', () => {
  for (const domain of privacyPlugin.DOMAINS) {
    const rule = `<exclude domain="${domain}" path="." />`;
    assert.match(privacyPlugin.FULL_BACKUP_CONTENT, new RegExp(rule.replace('.', '[.]'), 'u'));
    assert.equal(privacyPlugin.DATA_EXTRACTION_RULES.split(rule).length - 1, 2);
  }
  assert.match(privacyPlugin.DATA_EXTRACTION_RULES, /<cloud-backup>/u);
  assert.match(privacyPlugin.DATA_EXTRACTION_RULES, /<device-transfer>/u);
});

test('lo splash usa il brand Onda senza salto cromatico', () => {
  const splashPlugin = appConfig.expo.plugins?.find(
    (plugin): plugin is [string, Record<string, unknown>] =>
      Array.isArray(plugin) && plugin[0] === 'expo-splash-screen',
  );

  assert.ok(splashPlugin, 'expo-splash-screen deve essere configurato');
  const options = splashPlugin[1];
  assert.equal(options.backgroundColor, appConfig.expo.backgroundColor);
  assert.equal(options.image, './assets/brand/onda-adaptive-foreground.png');
  assert.equal(options.imageWidth, 200);
  assert.deepEqual(options.dark, { backgroundColor: '#0E1116' });
});

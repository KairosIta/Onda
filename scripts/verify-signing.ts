/// <reference types="node" />

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  normalizeCertificateSha256,
  parseKeyValueFile,
  validateReleaseIdentity,
  validateSigningProperties,
  type ReleaseIdentity,
} from './release-policy.ts';

const root = resolve(import.meta.dirname, '..');
const identityPath = join(root, 'release/identity.json');
const appConfigPath = join(root, 'app.json');

function fail(message: string): never {
  console.error(`Verifica firma fallita: ${message}`);
  process.exit(1);
}

if (process.argv.length > 3) {
  fail('uso: npm run verify:signing -- [directory-credenziali].');
}

const credentialsDir = process.argv[2] ? resolve(process.argv[2]) : join(root, 'credentials');
const propertiesPath = join(credentialsDir, 'keystore.properties');

if (!existsSync(propertiesPath)) fail('manca credentials/keystore.properties.');
if (!existsSync(identityPath)) fail('manca release/identity.json.');

const appConfig = JSON.parse(readFileSync(appConfigPath, 'utf8')) as {
  expo: { android: { package: string } };
};
const identity = JSON.parse(readFileSync(identityPath, 'utf8')) as ReleaseIdentity;
const properties = parseKeyValueFile(readFileSync(propertiesPath, 'utf8'));
const errors = [
  ...validateSigningProperties(properties, credentialsDir),
  ...validateReleaseIdentity(identity, appConfig.expo.android.package),
];
const storeFile = properties.storeFile?.trim();
const keystorePath = storeFile ? resolve(credentialsDir, storeFile) : '';
if (storeFile && !existsSync(keystorePath)) errors.push('Il keystore configurato non esiste.');
if (errors.length) fail(errors.join('\n- '));

const executableSuffix = process.platform === 'win32' ? '.exe' : '';
const keytoolCandidate = process.env.JAVA_HOME
  ? join(process.env.JAVA_HOME, 'bin', `keytool${executableSuffix}`)
  : '';
const keytool = keytoolCandidate && existsSync(keytoolCandidate) ? keytoolCandidate : 'keytool';
const keytoolEnvironment: NodeJS.ProcessEnv = {
  ...process.env,
  ONDA_RELEASE_KEY_PASSWORD: properties.keyPassword ?? '',
  ONDA_RELEASE_STORE_PASSWORD: properties.storePassword ?? '',
};
const listResult = spawnSync(
  keytool,
  [
    '-list',
    '-v',
    '-keystore',
    keystorePath,
    '-alias',
    properties.keyAlias,
    '-storepass:env',
    'ONDA_RELEASE_STORE_PASSWORD',
  ],
  { cwd: root, env: keytoolEnvironment, encoding: 'utf8' },
);

if (listResult.error) fail(`${keytool}: ${listResult.error.message}`);
if (listResult.status !== 0) {
  fail("keytool non riesce ad aprire il keystore con l'alias configurato.");
}

const privateKeyResult = spawnSync(
  keytool,
  [
    '-certreq',
    '-alias',
    properties.keyAlias,
    '-keystore',
    keystorePath,
    '-storepass:env',
    'ONDA_RELEASE_STORE_PASSWORD',
    '-keypass:env',
    'ONDA_RELEASE_KEY_PASSWORD',
  ],
  { cwd: root, env: keytoolEnvironment, encoding: 'utf8' },
);
delete keytoolEnvironment.ONDA_RELEASE_KEY_PASSWORD;
delete keytoolEnvironment.ONDA_RELEASE_STORE_PASSWORD;

if (privateKeyResult.error) fail(`${keytool}: ${privateKeyResult.error.message}`);
if (privateKeyResult.status !== 0) {
  fail('keytool non riesce ad accedere alla chiave privata con la password configurata.');
}

const digestMatch = /SHA256:\s*([0-9A-F:]+)/iu.exec(
  `${listResult.stdout ?? ''}\n${listResult.stderr ?? ''}`,
);
if (!digestMatch) fail('impossibile leggere il certificato dal keystore.');

const actualDigest = normalizeCertificateSha256(digestMatch[1]);
const expectedDigest = normalizeCertificateSha256(identity.certificateSha256);
if (actualDigest !== expectedDigest) {
  fail("il certificato non coincide con l'identita' di release attesa per Onda.");
}

console.log(`Chiave privata e firma Onda verificate in ${credentialsDir}: ${actualDigest}`);

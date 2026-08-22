/// <reference types="node" />

import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { basename, join, resolve } from 'node:path';
import {
  parseKeyValueFile,
  normalizeCertificateSha256,
  resolveReleaseEnvironment,
  validateJamendoClientId,
  validateReleaseIdentity,
  validateSigningProperties,
  type ReleaseIdentity,
} from './release-policy.ts';

const root = resolve(import.meta.dirname, '..');
const credentialsDir = join(root, 'credentials');
const propertiesPath = join(credentialsDir, 'keystore.properties');
const envPath = join(root, '.env');
const appConfigPath = join(root, 'app.json');
const releaseIdentityPath = join(root, 'release/identity.json');
const apkPath = join(root, 'android/app/build/outputs/apk/release/app-release.apk');
const mappingPath = join(root, 'android/app/build/outputs/mapping/release/mapping.txt');

function fail(message: string): never {
  console.error(`\nRelease interrotta: ${message}`);
  process.exit(1);
}

function capture(command: string, args: string[], env: NodeJS.ProcessEnv): string {
  const result = spawnSync(command, args, { cwd: root, env, encoding: 'utf8' });
  if (result.error) fail(`${command}: ${result.error.message}`);
  if (result.status !== 0) {
    const details = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
    fail(`${command} ${args.join(' ')} non riuscito.${details ? `\n${details}` : ''}`);
  }
  return `${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim();
}

function run(label: string, command: string, args: string[], env: NodeJS.ProcessEnv): void {
  console.log(`\n==> ${label}`);
  const result = spawnSync(command, args, { cwd: root, env, stdio: 'inherit' });
  if (result.error) fail(`${command}: ${result.error.message}`);
  if (result.status !== 0) fail(`${label} non riuscito (exit ${result.status ?? 'sconosciuto'}).`);
}

if (!existsSync(envPath)) fail('manca .env; copiare .env.example e configurarlo.');
if (!existsSync(propertiesPath)) fail('manca credentials/keystore.properties.');
if (!existsSync(releaseIdentityPath)) fail('manca release/identity.json.');

const appConfig = JSON.parse(readFileSync(appConfigPath, 'utf8')) as {
  expo: { android: { package: string; versionCode: number }; version: string };
};
const releaseIdentity = JSON.parse(readFileSync(releaseIdentityPath, 'utf8')) as ReleaseIdentity;

const fileEnvironment = parseKeyValueFile(readFileSync(envPath, 'utf8'));
const releaseEnvironment = resolveReleaseEnvironment(fileEnvironment, process.env);
delete releaseEnvironment.ONDA_ALLOW_DEBUG_RELEASE;
delete releaseEnvironment.ONDA_FORCE_DEBUG_RELEASE;
releaseEnvironment.CI = '1';

const signingProperties = parseKeyValueFile(readFileSync(propertiesPath, 'utf8'));
const configErrors = [
  ...validateJamendoClientId(releaseEnvironment.EXPO_PUBLIC_JAMENDO_CLIENT_ID),
  ...validateSigningProperties(signingProperties, credentialsDir),
  ...validateReleaseIdentity(releaseIdentity, appConfig.expo.android.package),
];
const storeFile = signingProperties.storeFile?.trim();
const keystorePath = storeFile ? resolve(credentialsDir, storeFile) : '';
if (storeFile && !existsSync(keystorePath))
  configErrors.push('Il keystore configurato non esiste.');
if (configErrors.length) fail(configErrors.join('\n- '));

const gitStatus = capture('git', ['status', '--porcelain'], releaseEnvironment);
if (gitStatus) {
  fail(
    "il worktree non e' pulito. Committare le modifiche prima di creare un artefatto distribuibile.",
  );
}

const javaVersion = capture('java', ['-version'], releaseEnvironment);
if (!/version\s+"17[."]/u.test(javaVersion.replaceAll('\\"', '"'))) {
  fail('la release richiede JDK 17.');
}

const sdkRoot = releaseEnvironment.ANDROID_HOME ?? releaseEnvironment.ANDROID_SDK_ROOT;
if (!sdkRoot) fail('ANDROID_HOME o ANDROID_SDK_ROOT non configurato.');
const executableSuffix = process.platform === 'win32' ? '.exe' : '';
const apksigner = join(sdkRoot, 'build-tools/36.0.0', `apksigner${executableSuffix}`);
if (!existsSync(apksigner)) fail('Android build-tools 36.0.0/apksigner non disponibile.');

const keytoolCandidate = releaseEnvironment.JAVA_HOME
  ? join(releaseEnvironment.JAVA_HOME, 'bin', `keytool${executableSuffix}`)
  : '';
const keytool = keytoolCandidate && existsSync(keytoolCandidate) ? keytoolCandidate : 'keytool';

const keytoolEnvironment: NodeJS.ProcessEnv = {
  ...releaseEnvironment,
  ONDA_RELEASE_KEY_PASSWORD: signingProperties.keyPassword ?? '',
  ONDA_RELEASE_STORE_PASSWORD: signingProperties.storePassword ?? '',
};
const keystoreInfo = capture(
  keytool,
  [
    '-list',
    '-v',
    '-keystore',
    keystorePath,
    '-alias',
    signingProperties.keyAlias,
    '-storepass:env',
    'ONDA_RELEASE_STORE_PASSWORD',
  ],
  keytoolEnvironment,
);
capture(
  keytool,
  [
    '-certreq',
    '-alias',
    signingProperties.keyAlias,
    '-keystore',
    keystorePath,
    '-storepass:env',
    'ONDA_RELEASE_STORE_PASSWORD',
    '-keypass:env',
    'ONDA_RELEASE_KEY_PASSWORD',
  ],
  keytoolEnvironment,
);
delete keytoolEnvironment.ONDA_RELEASE_KEY_PASSWORD;
delete keytoolEnvironment.ONDA_RELEASE_STORE_PASSWORD;
const keystoreDigestMatch = /SHA256:\s*([0-9A-F:]+)/iu.exec(keystoreInfo);
if (!keystoreDigestMatch) fail('impossibile leggere il certificato dal keystore.');
const keystoreCertificateSha256 = normalizeCertificateSha256(keystoreDigestMatch[1]);
const expectedCertificateSha256 = normalizeCertificateSha256(releaseIdentity.certificateSha256);
if (keystoreCertificateSha256 !== expectedCertificateSha256) {
  fail("il keystore non coincide con l'identita' di firma attesa per Onda.");
}

run('Test unitari', 'npm', ['test'], releaseEnvironment);
run('TypeScript', 'npm', ['run', 'typecheck'], releaseEnvironment);
run('ESLint', 'npm', ['run', 'lint'], releaseEnvironment);
run('Prettier', 'npm', ['run', 'format:check'], releaseEnvironment);
run(
  'Prebuild Android pulito',
  'npx',
  ['expo', 'prebuild', '--platform', 'android', '--clean', '--no-install'],
  releaseEnvironment,
);
run('Android Lint', 'npm', ['run', 'android:lint'], releaseEnvironment);
run(
  'APK release firmato',
  join(root, 'android/gradlew'),
  ['-p', 'android', 'assembleRelease', '--no-daemon'],
  releaseEnvironment,
);

if (!existsSync(apkPath)) fail('Gradle ha terminato senza produrre app-release.apk.');
if (!existsSync(mappingPath)) fail('R8 non ha prodotto il mapping della release.');

const apkVerification = capture(
  apksigner,
  ['verify', '--verbose', '--print-certs', apkPath],
  releaseEnvironment,
);
if (!/^Verifies$/mu.test(apkVerification)) fail("apksigner non conferma la validita' dell'APK.");
const apkDigestMatch = /Signer #1 certificate SHA-256 digest:\s*([0-9a-f]+)/iu.exec(
  apkVerification,
);
if (!apkDigestMatch) fail("impossibile leggere il certificato dall'APK.");

const apkCertificateSha256 = normalizeCertificateSha256(apkDigestMatch[1]);
if (apkCertificateSha256 !== keystoreCertificateSha256) {
  fail("il certificato dell'APK non coincide con il keystore di release.");
}

const abiListing = capture('unzip', ['-Z1', apkPath], releaseEnvironment);
const abis = [
  ...new Set(
    abiListing
      .split(/\r?\n/u)
      .map((entry) => /^lib\/([^/]+)\//u.exec(entry)?.[1])
      .filter((abi): abi is string => Boolean(abi)),
  ),
].sort();
const expectedAbis = ['arm64-v8a', 'armeabi-v7a'];
if (abis.join(',') !== expectedAbis.join(',')) {
  fail(`ABI inattese: ${abis.join(', ') || 'nessuna'}.`);
}

const commit = capture('git', ['rev-parse', 'HEAD'], releaseEnvironment);
const apkBytes = statSync(apkPath).size;
const apkSha256 = createHash('sha256').update(readFileSync(apkPath)).digest('hex');
const baseName = `onda-${appConfig.expo.version}-${appConfig.expo.android.versionCode}-${commit.slice(0, 12)}`;
const outputDir = join(root, 'dist/release');
const outputApk = join(outputDir, `${baseName}.apk`);
mkdirSync(outputDir, { recursive: true });
copyFileSync(apkPath, outputApk);
copyFileSync(mappingPath, join(outputDir, `${baseName}-mapping.txt`));

const manifest = {
  package: appConfig.expo.android.package,
  version: appConfig.expo.version,
  versionCode: appConfig.expo.android.versionCode,
  commit,
  apk: basename(outputApk),
  bytes: apkBytes,
  sha256: apkSha256,
  certificateSha256: apkCertificateSha256,
  abis,
};
writeFileSync(
  join(outputDir, `${baseName}.json`),
  `${JSON.stringify(manifest, null, 2)}\n`,
  'utf8',
);

console.log('\nRelease verificata e archiviata:');
console.log(`- APK: ${outputApk}`);
console.log(`- SHA-256: ${apkSha256}`);
console.log(`- Byte: ${apkBytes}`);
console.log(`- ABI: ${abis.join(', ')}`);
console.log(`- Certificato SHA-256: ${apkCertificateSha256}`);

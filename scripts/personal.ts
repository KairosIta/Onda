/// <reference types="node" />

import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { basename, join, resolve } from 'node:path';
import {
  normalizeCertificateSha256,
  parseKeyValueFile,
  resolveReleaseEnvironment,
  validateJamendoClientId,
  type ReleaseIdentity,
} from './release-policy.ts';
import {
  MINIMUM_NODE_VERSION,
  androidExecutable,
  androidSdkCandidates,
  checkNodeVersion,
  commandSpec,
  gradleWrapper,
  npmExecutable,
  npxExecutable,
  parseJavaMajor,
} from './personal-policy.ts';

const root = resolve(import.meta.dirname, '..');
const envPath = join(root, '.env');
const envExamplePath = join(root, '.env.example');
const apkPath = join(
  root,
  'android',
  'app',
  'build',
  'outputs',
  'apk',
  'release',
  'app-release.apk',
);
const personalDir = join(root, 'dist', 'personal');
const personalApkPath = join(personalDir, 'Onda-personal.apk');
const personalKeystorePath = join(root, '.onda', 'personal-debug.keystore');

type Check = { label: string; ok: boolean; detail: string; required?: boolean };

function fail(message: string): never {
  console.error(`\nOnda: ${message}`);
  process.exit(1);
}

function capture(command: string, args: string[], env: NodeJS.ProcessEnv = process.env) {
  const spec = commandSpec(command);
  return spawnSync(spec.command, args, {
    cwd: root,
    env,
    encoding: 'utf8',
    shell: spec.shell,
  });
}

function run(label: string, command: string, args: string[], env: NodeJS.ProcessEnv): void {
  console.log(`\n==> ${label}`);
  const spec = commandSpec(command);
  const result = spawnSync(spec.command, args, {
    cwd: root,
    env,
    stdio: 'inherit',
    shell: spec.shell,
  });
  if (result.error) fail(`${label}: ${result.error.message}`);
  if (result.status !== 0) fail(`${label} non riuscito (exit ${result.status ?? 'sconosciuto'}).`);
}

function loadPersonalEnvironment(): NodeJS.ProcessEnv {
  const fileValues = existsSync(envPath) ? parseKeyValueFile(readFileSync(envPath, 'utf8')) : {};
  return {
    ...resolveReleaseEnvironment(fileValues, process.env),
    ONDA_ALLOW_DEBUG_RELEASE: '1',
    ONDA_FORCE_DEBUG_RELEASE: '1',
    CI: '1',
  };
}

function findAndroidSdk(env: NodeJS.ProcessEnv): string | undefined {
  return androidSdkCandidates(env).find((candidate) => existsSync(candidate));
}

function collectChecks(env: NodeJS.ProcessEnv, requireConfiguration = true): Check[] {
  const checks: Check[] = [];
  const node = checkNodeVersion();
  checks.push({
    label: 'Node.js',
    ok: node.supported,
    detail: `${node.actual} (richiesto >= ${MINIMUM_NODE_VERSION.join('.')})`,
  });

  const java = capture('java', ['-version'], env);
  const javaOutput = `${java.stdout ?? ''}\n${java.stderr ?? ''}`;
  const javaMajor = java.status === 0 ? parseJavaMajor(javaOutput) : undefined;
  checks.push({
    label: 'JDK',
    ok: javaMajor === 17,
    detail: javaMajor ? `Java ${javaMajor} (richiesto 17)` : 'java non trovato (richiesto JDK 17)',
  });

  const sdk = findAndroidSdk(env);
  checks.push({
    label: 'Android SDK',
    ok: Boolean(sdk),
    detail: sdk ?? 'non trovato; configura ANDROID_HOME',
  });
  if (sdk) {
    checks.push({
      label: 'Android platform',
      ok: existsSync(join(sdk, 'platforms', 'android-36')),
      detail: 'platforms/android-36',
    });
    checks.push({
      label: 'Android build-tools',
      ok: existsSync(join(sdk, 'build-tools', '36.0.0')),
      detail: 'build-tools/36.0.0',
    });
    checks.push({
      label: 'ADB',
      ok: existsSync(join(sdk, 'platform-tools', androidExecutable('adb'))),
      detail: 'platform-tools/adb',
      required: false,
    });
  }

  checks.push({
    label: 'Dipendenze npm',
    ok: existsSync(join(root, 'node_modules')),
    detail: existsSync(join(root, 'node_modules')) ? 'installate' : 'esegui npm ci',
  });

  const jamendoErrors = validateJamendoClientId(env.EXPO_PUBLIC_JAMENDO_CLIENT_ID);
  checks.push({
    label: 'Jamendo Client ID',
    ok: jamendoErrors.length === 0,
    detail: jamendoErrors[0] ?? 'configurato',
    required: requireConfiguration,
  });

  return checks;
}

function doctor(requireConfiguration = true): { checks: Check[]; sdk?: string } {
  const env = loadPersonalEnvironment();
  const checks = collectChecks(env, requireConfiguration);
  console.log('\nDiagnosi ambiente Onda\n');
  for (const check of checks) {
    const optional = check.required === false ? ' (serve solo per installare)' : '';
    console.log(
      `${check.ok ? 'OK ' : check.required === false ? '-- ' : 'ERRORE '} ${check.label}${optional}: ${check.detail}`,
    );
  }
  const errors = checks.filter((check) => !check.ok && check.required !== false);
  if (errors.length) {
    fail(`${errors.length} requisito/i da sistemare. Consulta docs/BUILD_PERSONAL.md.`);
  }
  console.log('\nAmbiente pronto per una build personale.');
  return { checks, sdk: findAndroidSdk(env) };
}

function setup(): void {
  if (existsSync(envPath)) {
    console.log('.env esiste gia: non e stato modificato.');
  } else {
    copyFileSync(envExamplePath, envPath);
    console.log('Creato .env da .env.example.');
  }
  console.log('Inserisci il tuo EXPO_PUBLIC_JAMENDO_CLIENT_ID in .env, poi esegui npm run doctor.');
}

function gradleArgs(task: string): string[] {
  const lintExclusions =
    task === ':app:lintRelease'
      ? [
          '-x',
          ':react-native-worklets:lintAnalyzeRelease',
          '-x',
          ':react-native-reanimated:lintAnalyzeRelease',
        ]
      : [];
  return ['-p', 'android', task, ...lintExclusions, '--no-daemon'];
}

function runAndroidLint(env = loadPersonalEnvironment()): void {
  const wrapper = gradleWrapper(root);
  if (!existsSync(wrapper)) fail('android/ non esiste: esegui prima npm run prebuild.');
  run('Android Lint', wrapper, gradleArgs(':app:lintRelease'), env);
}

function javaTool(name: string, env: NodeJS.ProcessEnv): string {
  return env.JAVA_HOME
    ? join(env.JAVA_HOME, 'bin', androidExecutable(name))
    : androidExecutable(name);
}

function preparePersonalDebugKeystore(env: NodeJS.ProcessEnv): void {
  mkdirSync(join(root, '.onda'), { recursive: true });
  const keytool = javaTool('keytool', env);
  if (!existsSync(personalKeystorePath)) {
    run(
      'Creazione firma personale persistente',
      keytool,
      [
        '-genkeypair',
        '-storetype',
        'PKCS12',
        '-keystore',
        personalKeystorePath,
        '-storepass',
        'android',
        '-alias',
        'androiddebugkey',
        '-keypass',
        'android',
        '-keyalg',
        'RSA',
        '-keysize',
        '2048',
        '-validity',
        '10000',
        '-dname',
        'CN=Onda Personal,OU=Personal Build,O=Onda,C=IT',
        '-noprompt',
      ],
      env,
    );
  }
  const verification = capture(
    keytool,
    [
      '-list',
      '-keystore',
      personalKeystorePath,
      '-storepass',
      'android',
      '-alias',
      'androiddebugkey',
    ],
    env,
  );
  if (verification.status !== 0) {
    fail('la firma personale in .onda/ non e leggibile; non verra sovrascritta automaticamente.');
  }
  copyFileSync(personalKeystorePath, join(root, 'android', 'app', 'debug.keystore'));
}

function build(): string {
  doctor(true);
  const env = loadPersonalEnvironment();
  const npm = npmExecutable();
  const npx = npxExecutable();

  run('Test unitari', npm, ['test'], env);
  run('TypeScript', npm, ['run', 'typecheck'], env);
  run('ESLint', npm, ['run', 'lint'], env);
  run('Prettier', npm, ['run', 'format:check'], env);
  run(
    'Prebuild Android pulito',
    npx,
    ['expo', 'prebuild', '--platform', 'android', '--clean', '--no-install'],
    env,
  );
  preparePersonalDebugKeystore(env);
  runAndroidLint(env);
  run('APK personale standalone', gradleWrapper(root), gradleArgs('assembleRelease'), env);

  if (!existsSync(apkPath)) fail('Gradle ha terminato senza produrre app-release.apk.');

  const sdk = findAndroidSdk(env);
  if (!sdk) fail('Android SDK non disponibile dopo la build.');
  const apksigner = join(sdk, 'build-tools', '36.0.0', androidExecutable('apksigner'));
  const signature = capture(apksigner, ['verify', '--verbose', '--print-certs', apkPath], env);
  const signatureOutput = `${signature.stdout ?? ''}\n${signature.stderr ?? ''}`;
  if (signature.status !== 0 || !/^Verifies$/mu.test(signatureOutput)) {
    fail("apksigner non conferma la validita' dell'APK personale.");
  }
  const certificateMatch = /Signer #1 certificate SHA-256 digest:\s*([0-9a-f]+)/iu.exec(
    signatureOutput,
  );
  if (!certificateMatch) fail("impossibile leggere il certificato dall'APK personale.");
  const certificateSha256 = normalizeCertificateSha256(certificateMatch[1]);
  const releaseIdentity = JSON.parse(
    readFileSync(join(root, 'release', 'identity.json'), 'utf8'),
  ) as ReleaseIdentity;
  if (certificateSha256 === normalizeCertificateSha256(releaseIdentity.certificateSha256)) {
    fail(
      "la build personale usa inaspettatamente il certificato ufficiale: l'APK e stato rifiutato.",
    );
  }

  const jar = javaTool('jar', env);
  const archive = capture(jar, ['tf', apkPath], env);
  const archiveEntries = (archive.stdout ?? '').split(/\r?\n/u);
  if (archive.status !== 0 || !archiveEntries.includes('assets/index.android.bundle')) {
    fail("l'APK non contiene il bundle JavaScript standalone.");
  }

  mkdirSync(personalDir, { recursive: true });
  copyFileSync(apkPath, personalApkPath);

  const appConfig = JSON.parse(readFileSync(join(root, 'app.json'), 'utf8')) as {
    expo: { android: { package: string; versionCode: number }; version: string };
  };
  const bytes = statSync(personalApkPath).size;
  const sha256 = createHash('sha256').update(readFileSync(personalApkPath)).digest('hex');
  writeFileSync(
    join(personalDir, 'Onda-personal.json'),
    `${JSON.stringify(
      {
        kind: 'personal-local-build',
        redistributable: false,
        package: appConfig.expo.android.package,
        version: appConfig.expo.version,
        versionCode: appConfig.expo.android.versionCode,
        apk: basename(personalApkPath),
        bytes,
        sha256,
        certificateSha256,
        standaloneBundle: true,
        builtAt: new Date().toISOString(),
      },
      null,
      2,
    )}\n`,
    'utf8',
  );

  console.log(`\nAPK personale creato: ${personalApkPath}`);
  console.log(`SHA-256: ${sha256}`);
  console.log(`Certificato locale SHA-256: ${certificateSha256}`);
  console.log(
    'Firma ufficiale esclusa e bundle standalone verificato. Non ridistribuire questo APK.',
  );
  return personalApkPath;
}

function install(): void {
  const outputApk = build();
  const env = loadPersonalEnvironment();
  const sdk = findAndroidSdk(env);
  const adb = sdk ? join(sdk, 'platform-tools', androidExecutable('adb')) : 'adb';
  const devices = capture(adb, ['devices'], env);
  if (devices.status !== 0) fail('ADB non disponibile. Installa Android SDK Platform-Tools.');
  const connected = `${devices.stdout ?? ''}`
    .split(/\r?\n/u)
    .filter((line) => /\tdevice$/u.test(line));
  if (connected.length !== 1) {
    fail(`serve esattamente un dispositivo/emulatore autorizzato; trovati ${connected.length}.`);
  }
  run('Installazione sul dispositivo', adb, ['install', '-r', outputApk], env);
  console.log(
    '\nOnda e installata. Se Android segnala una firma incompatibile, disinstalla una vecchia copia e riprova.',
  );
}

const action = process.argv[2];
switch (action) {
  case 'setup':
    setup();
    break;
  case 'doctor':
    doctor(true);
    break;
  case 'build':
    build();
    break;
  case 'install':
    install();
    break;
  case 'android-lint':
    runAndroidLint();
    break;
  default:
    fail('azione non valida. Usa setup, doctor, build, install o android-lint.');
}

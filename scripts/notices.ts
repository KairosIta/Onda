/// <reference types="node" />

/**
 * `npm run notices` rigenera `assets/legal/third-party-notices.json`, gli
 * avvisi di tutto cio' che l'APK incorpora; con `--check` verifica che il
 * file committato corrisponda alle dipendenze correnti, come fa la CI.
 *
 * Due fonti, perche' nessuna da sola basta: la source map del bundle
 * Android esportato da Metro dice quali pacchetti npm finiscono davvero nel
 * JS (75 su oltre 500 di produzione); il classpath di release di Gradle,
 * letto dall'init script `scripts/gradle/notices.init.gradle`, dice quali
 * artefatti Maven e quali moduli nativi entrano nell'APK. Le decisioni su
 * licenze e testi stanno in `notices-core.ts`.
 */

import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import {
  APACHE_TEXT,
  buildNotices,
  compareNotices,
  packageFromPath,
  renderNotices,
  type MavenInput,
  type Notices,
  type NpmInput,
  type Overrides,
  type PackageRef,
  type Scope,
} from './notices-core.ts';
import { commandSpec, gradleWrapper, npxExecutable } from './personal-policy.ts';

const root = resolve(import.meta.dirname, '..');
const outputPath = join(root, 'assets', 'legal', 'third-party-notices.json');
const noticesDir = join(root, 'scripts', 'notices');
const initScript = join(root, 'scripts', 'gradle', 'notices.init.gradle');
const checkOnly = process.argv.includes('--check');

// Nessuna credenziale serve qui: `.env` resta fuori dal bundle esportato e
// la build e' etichettata come personale, come in scripts/personal.ts.
const env: NodeJS.ProcessEnv = {
  ...process.env,
  CI: '1',
  EXPO_NO_DOTENV: '1',
  ONDA_FORCE_DEBUG_RELEASE: '1',
  ONDA_ALLOW_DEBUG_RELEASE: '1',
};

function fail(message: string): never {
  console.error(`\nAvvisi: ${message}`);
  process.exit(1);
}

function run(label: string, command: string, args: string[]): void {
  console.log(`\n==> ${label}`);
  const spec = commandSpec(command);
  const result = spawnSync(spec.command, args, {
    cwd: root,
    env,
    encoding: 'utf8',
    shell: spec.shell,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error) fail(`${label}: ${result.error.message}`);
  if (result.status !== 0) {
    console.error(result.stdout);
    console.error(result.stderr);
    fail(`${label} non riuscito (exit ${result.status ?? 'sconosciuto'}).`);
  }
}

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else yield path;
  }
}

/** I pacchetti che Metro ha messo nel bundle: dai sorgenti della source map. */
function bundlePackages(exportDir: string): PackageRef[] {
  const refs = new Map<string, PackageRef>();
  for (const file of walk(exportDir)) {
    if (!file.endsWith('.map')) continue;
    const { sources = [] } = JSON.parse(readFileSync(file, 'utf8')) as { sources?: string[] };
    for (const source of sources) {
      // Metro scrive i percorsi relativi alla radice, con una barra iniziale.
      const path = isAbsolute(source) && existsSync(source) ? source : join(root, source);
      const ref = packageFromPath(path);
      if (ref) refs.set(ref.dir, ref);
    }
  }
  return [...refs.values()];
}

interface GradleDump {
  artifacts: {
    group: string;
    name: string;
    version: string;
    file: string;
    poms: string[];
    notices: { path: string; text: string }[];
  }[];
  projects: { path: string; dir: string | null }[];
}

type PackageJson = {
  name?: string;
  version?: string;
  license?: unknown;
  author?: unknown;
};

const stringOr = (value: unknown, key: string): string | undefined =>
  typeof value === 'string'
    ? value
    : typeof value === 'object' && value !== null && key in value
      ? String((value as Record<string, unknown>)[key])
      : undefined;

function addPackage(ref: PackageRef, scope: Scope, into: Map<string, NpmInput>): void {
  const manifest = join(ref.dir, 'package.json');
  if (!existsSync(manifest)) fail(`${ref.dir} non ha package.json.`);
  const pkg = JSON.parse(readFileSync(manifest, 'utf8')) as PackageJson;
  const key = `${pkg.name ?? ref.name}@${pkg.version ?? '?'}`;
  const existing = into.get(key);
  if (existing) {
    if (!existing.scopes.includes(scope)) existing.scopes.push(scope);
    return;
  }
  const texts = readdirSync(ref.dir)
    .filter((file) => /^(LICENSE|LICENCE|COPYING)(\.(md|txt|markdown))?$/iu.test(file))
    .sort()
    .map((file) => ({ file, text: readFileSync(join(ref.dir, file), 'utf8') }));
  into.set(key, {
    name: pkg.name ?? ref.name,
    version: pkg.version ?? '?',
    license: stringOr(pkg.license, 'type'),
    author: stringOr(pkg.author, 'name'),
    texts,
    scopes: [scope],
  });
}

if (!existsSync(join(root, 'node_modules'))) fail('esegui prima npm ci.');
const wrapper = gradleWrapper(root);
if (!existsSync(wrapper)) fail('android/ non esiste: esegui prima npm run prebuild.');

const work = mkdtempSync(join(tmpdir(), 'onda-notices-'));
let notices: Notices;
try {
  const exportDir = join(work, 'export');
  run('Bundle Android con source map', npxExecutable(), [
    'expo',
    'export',
    '--platform',
    'android',
    '--output-dir',
    exportDir,
    '--dump-sourcemap',
    '--no-bytecode',
  ]);
  const gradleOut = join(work, 'gradle.json');
  run('Classpath di release da Gradle', wrapper, [
    '-p',
    'android',
    '--init-script',
    initScript,
    `-PondaNoticesOut=${gradleOut}`,
    ':app:ondaNotices',
    '-q',
    '--no-daemon',
  ]);

  const npm = new Map<string, NpmInput>();
  for (const ref of bundlePackages(exportDir)) addPackage(ref, 'js', npm);

  const dump = JSON.parse(readFileSync(gradleOut, 'utf8')) as GradleDump;
  const maven: MavenInput[] = [];
  for (const artifact of dump.artifacts) {
    // Gli AAR precompilati di Expo stanno nel pacchetto npm: la licenza e' la sua.
    const ref = packageFromPath(artifact.file);
    if (ref) addPackage(ref, 'android', npm);
    else {
      maven.push({
        group: artifact.group,
        name: artifact.name,
        version: artifact.version,
        poms: artifact.poms.map((pom) => readFileSync(pom, 'utf8')),
        notices: artifact.notices,
      });
    }
  }
  // I progetti Gradle sono i moduli compilati dai sorgenti in node_modules;
  // :app e :onda-player sono codice Onda e non compaiono.
  for (const project of dump.projects) {
    const ref = project.dir ? packageFromPath(project.dir) : undefined;
    if (ref) addPackage(ref, 'android', npm);
  }

  const overrides = JSON.parse(
    readFileSync(join(noticesDir, 'overrides.json'), 'utf8'),
  ) as Overrides;
  const textPaths = new Set<string>([APACHE_TEXT]);
  for (const override of [
    ...Object.values(overrides.packages ?? {}),
    ...Object.values(overrides.artifacts ?? {}),
    ...(overrides.fonts ?? []),
  ]) {
    for (const path of [override.textPath ?? []].flat()) textPaths.add(path);
  }
  const textFiles = Object.fromEntries(
    [...textPaths].map((path) => {
      const full = resolve(noticesDir, path);
      if (!existsSync(full)) fail(`manca il testo ${path} in scripts/notices/.`);
      return [path, readFileSync(full, 'utf8')];
    }),
  );

  try {
    notices = buildNotices({ npm: [...npm.values()], maven, overrides, textFiles });
  } catch (error) {
    fail(`${(error as Error).message}\n\nCompleta scripts/notices/overrides.json e riprova.`);
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}

const rendered = renderNotices(notices);
const shown = relative(root, outputPath);
const kinds = Object.entries(notices.summary.byKind)
  .map(([kind, count]) => `${count} ${kind}`)
  .join(', ');

if (checkOnly) {
  // Git su Windows puo' aver convertito i fine riga: si confronta il contenuto.
  const current = existsSync(outputPath)
    ? readFileSync(outputPath, 'utf8').replace(/\r\n/gu, '\n')
    : undefined;
  if (current === rendered) {
    console.log(
      `\n${shown} corrisponde alle dipendenze: ${notices.summary.components} componenti (${kinds}).`,
    );
  } else {
    const differences = current
      ? compareNotices(JSON.parse(current) as Notices, notices)
      : ['il file non esiste'];
    console.error(`\n${differences.join('\n')}`);
    fail(
      `${shown} non corrisponde alle dipendenze: esegui npm run notices e committa il risultato.`,
    );
  }
} else {
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, rendered);
  console.log(
    `\nScritto ${shown}: ${notices.summary.components} componenti (${kinds}), ` +
      `${Object.keys(notices.licenses).length} testi distinti, ${Math.round(rendered.length / 1024)} KB.`,
  );
}

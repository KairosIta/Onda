/// <reference types="node" />

/**
 * Avvisi delle dipendenze incorporate nell'APK (nota di conformita', gate 5):
 * la parte pura, che i test raggiungono. `notices.ts` legge file, lancia
 * `expo export` e Gradle e passa qui i dati; `buildNotices` decide licenza,
 * testo e ordine di ogni componente e produce un JSON identico a parita' di
 * dipendenze, su qualunque sistema.
 */

import { createHash } from 'node:crypto';

export const NOTICES_SCHEMA = 1;

/** Il testo canonico di Apache 2.0: uguale per ogni artefatto che la dichiara. */
export const APACHE_TEXT = 'texts/Apache-2.0.txt';

export interface PomLicense {
  name: string;
  url: string;
}

export interface PomInfo {
  name?: string;
  url?: string;
  organization?: string;
  developers: string[];
  licenses: PomLicense[];
  parent?: { groupId?: string; artifactId?: string; version?: string };
}

// Blocchi annidati che hanno un <name> o un <url> proprio: si tolgono prima
// di leggere quelli del progetto.
const NESTED_BLOCKS = [
  'parent',
  'licenses',
  'developers',
  'contributors',
  'organization',
  'dependencies',
  'dependencyManagement',
  'build',
  'profiles',
  'scm',
  'issueManagement',
  'ciManagement',
  'distributionManagement',
  'properties',
  'mailingLists',
  'reporting',
  'repositories',
  'pluginRepositories',
];

const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&apos;': "'",
};

const decode = (value: string): string =>
  value.replace(/&(?:amp|lt|gt|quot|apos);/gu, (entity) => ENTITIES[entity] ?? entity);

function tagText(xml: string, tag: string): string | undefined {
  const match = xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([^<]*)</${tag}>`, 'u'));
  const value = match?.[1].trim();
  return value ? decode(value) : undefined;
}

function tagBlock(xml: string, tag: string): string | undefined {
  return xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'u'))?.[1];
}

/** Legge da un POM quello che serve agli avvisi; i commenti non contano. */
export function parsePom(xml: string): PomInfo {
  const body = xml.replace(/<!--[\s\S]*?-->/gu, '');
  let top = body;
  for (const tag of NESTED_BLOCKS) {
    top = top.replace(new RegExp(`<${tag}(?:\\s[^>]*)?>[\\s\\S]*?</${tag}>`, 'gu'), '');
  }
  const parent = tagBlock(body, 'parent');
  const licenses = [
    ...(tagBlock(body, 'licenses') ?? '').matchAll(/<license>([\s\S]*?)<\/license>/gu),
  ].map((match) => ({
    name: tagText(match[1], 'name') ?? '',
    url: tagText(match[1], 'url') ?? '',
  }));
  const developers = [
    ...(tagBlock(body, 'developers') ?? '').matchAll(/<developer>([\s\S]*?)<\/developer>/gu),
  ]
    .map((match) => tagText(match[1], 'name') ?? tagText(match[1], 'id'))
    .filter((developer): developer is string => Boolean(developer));
  return {
    name: tagText(top, 'name'),
    url: tagText(top, 'url'),
    organization: tagText(tagBlock(body, 'organization') ?? '', 'name'),
    developers,
    licenses,
    parent: parent
      ? {
          groupId: tagText(parent, 'groupId'),
          artifactId: tagText(parent, 'artifactId'),
          version: tagText(parent, 'version'),
        }
      : undefined,
  };
}

/**
 * Dal nome libero del POM all'identificatore SPDX. Le grafie di Apache 2.0
 * sono molte; quello che non si riconosce resta `undefined` e chiede un
 * override esplicito, mai un'ipotesi.
 */
export function spdxFromPom(license: PomLicense): string | undefined {
  const name = license.name.trim().toLowerCase();
  const url = license.url.trim().toLowerCase();
  if (/apache/u.test(name) || /apache\.org\/licenses\/license-2\.0/u.test(url)) return 'Apache-2.0';
  if (/\bmit\b/u.test(name) || /opensource\.org\/licenses?\/mit\b/u.test(url)) return 'MIT';
  if (/bsd[- ]?3|new bsd|modified bsd|3-clause/u.test(name)) return 'BSD-3-Clause';
  if (/bsd[- ]?2|simplified bsd|freebsd|2-clause/u.test(name)) return 'BSD-2-Clause';
  return undefined;
}

export interface PackageRef {
  name: string;
  dir: string;
}

/**
 * Il pacchetto npm a cui appartiene un file: l'ultimo `node_modules/` del
 * percorso, con lo scope se c'e'. Vale per i sorgenti della source map, per i
 * progetti Gradle dei moduli nativi e per gli AAR precompilati di Expo, che
 * stanno in `node_modules/<pacchetto>/local-maven-repo/`.
 */
export function packageFromPath(filePath: string): PackageRef | undefined {
  const normalized = filePath.replace(/\\/gu, '/');
  const marker = '/node_modules/';
  const index = normalized.lastIndexOf(marker);
  if (index < 0) return undefined;
  const parts = normalized.slice(index + marker.length).split('/');
  const scoped = parts[0]?.startsWith('@');
  if (!parts[0] || (scoped && !parts[1])) return undefined;
  const name = scoped ? `${parts[0]}/${parts[1]}` : parts[0];
  return { name, dir: normalized.slice(0, index + marker.length) + name };
}

export interface LicenseText {
  /** Nome del file nel pacchetto, solo per i messaggi. */
  file: string;
  text: string;
}

export type Scope = 'js' | 'android';

export interface NpmInput {
  name: string;
  version: string;
  license?: string;
  author?: string;
  texts: LicenseText[];
  /** Dove il pacchetto entra nell'APK: nel bundle JS, come modulo nativo, o entrambi. */
  scopes: Scope[];
}

export interface MavenNotice {
  path: string;
  text: string;
}

export interface MavenInput {
  group: string;
  name: string;
  version: string;
  /** I POM in XML: quello dell'artefatto e poi i genitori, fino al primo con la licenza. */
  poms: string[];
  /** File META-INF/LICENSE* e META-INF/NOTICE* trovati nell'archivio. */
  notices: MavenNotice[];
}

export interface Override {
  /** Espressione SPDX, quando il POM o il package.json non la dicono o la dicono male. */
  license?: string;
  /** Testi in scripts/notices/, quando il pacchetto o l'archivio non li porta. */
  textPath?: string | string[];
  /** Pacchetto npm da cui copiare il testo (monorepo che non lo mette nel tarball). */
  textFrom?: string;
  holder?: string;
  url?: string;
  note?: string;
}

export interface FontOverride extends Override {
  name: string;
  /** Pacchetto o meccanismo che porta il font nell'APK. */
  via: string;
}

export interface Overrides {
  packages?: Record<string, Override>;
  artifacts?: Record<string, Override>;
  fonts?: FontOverride[];
}

export interface BuildInput {
  npm: NpmInput[];
  maven: MavenInput[];
  overrides: Overrides;
  /** Testi referenziati dagli override, per percorso relativo a scripts/notices/. */
  textFiles: Record<string, string>;
}

export type ComponentKind = 'android' | 'npm' | 'font';

export interface Component {
  kind: ComponentKind;
  name: string;
  version?: string;
  license: string;
  holder?: string;
  url?: string;
  via?: string;
  scopes?: Scope[];
  /** Id dei testi di licenza in `licenses`. */
  texts: string[];
  /** Id dei file NOTICE (Apache 2.0, sezione 4d), quando l'archivio li porta. */
  notices?: string[];
}

export interface Notices {
  schema: typeof NOTICES_SCHEMA;
  summary: {
    components: number;
    byKind: Record<string, number>;
    byLicense: Record<string, number>;
  };
  licenses: Record<string, { text: string }>;
  components: Component[];
}

const KIND_ORDER: ComponentKind[] = ['android', 'npm', 'font'];

const compare = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** Fine riga e spazi finali uniformi, cosi' il testo ha lo stesso id su ogni sistema. */
export function normalizeText(text: string): string {
  const lines = text
    .replace(/^﻿/u, '')
    .replace(/\r\n?/gu, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/u, ''));
  return `${lines.join('\n').trim()}\n`;
}

export function textId(text: string): string {
  return createHash('sha256').update(normalizeText(text)).digest('hex').slice(0, 16);
}

/** La riga del titolare, se il testo ne ha una che comincia con «Copyright». */
export function copyrightLine(text: string): string | undefined {
  return text.match(/^[ \t]*(?:\(c\)[ \t]*|©[ \t]*)?copyright\b[^\n]*/imu)?.[0].trim();
}

const asList = (value: string | string[] | undefined): string[] =>
  value === undefined ? [] : Array.isArray(value) ? value : [value];

function sortedCounts(entries: Iterable<string>): Record<string, number> {
  const counts = new Map<string, number>();
  for (const entry of entries) counts.set(entry, (counts.get(entry) ?? 0) + 1);
  return Object.fromEntries([...counts].sort(([a], [b]) => compare(a, b)));
}

/**
 * Da pacchetti, artefatti e override ai componenti con i loro testi.
 * Se manca una licenza, un testo o un file, si ferma elencando ogni caso:
 * la scelta spetta a chi aggiorna `scripts/notices/overrides.json`, non a
 * un'ipotesi del generatore. Anche un override che non serve piu' e' un
 * errore, cosi' il file dice sempre il vero.
 */
export function buildNotices(input: BuildInput): Notices {
  const problems: string[] = [];
  const texts = new Map<string, string>();
  const usedOverrides = new Set<string>();
  const apacheId = input.textFiles[APACHE_TEXT] ? textId(input.textFiles[APACHE_TEXT]) : undefined;

  const intern = (raw: string): string => {
    const normalized = normalizeText(raw);
    const id = textId(normalized);
    texts.set(id, normalized);
    return id;
  };
  const fromFile = (path: string, who: string): string | undefined => {
    const text = input.textFiles[path];
    if (text === undefined) {
      problems.push(`${who}: il testo ${path} non e' in scripts/notices/.`);
      return undefined;
    }
    return intern(text);
  };
  const byName = new Map(input.npm.map((pkg) => [pkg.name, pkg]));
  const ownTexts = (pkg: NpmInput): string[] => pkg.texts.map((entry) => intern(entry.text));
  const fromPackage = (name: string, who: string): string[] => {
    const source = byName.get(name);
    if (!source || source.texts.length === 0) {
      problems.push(`${who}: textFrom "${name}" non e' un pacchetto con un file di licenza.`);
      return [];
    }
    return ownTexts(source);
  };
  const resolveTexts = (override: Override | undefined, own: string[], who: string): string[] => {
    const paths = asList(override?.textPath);
    if (paths.length) {
      return paths.map((path) => fromFile(path, who)).filter((id): id is string => Boolean(id));
    }
    if (override?.textFrom) return fromPackage(override.textFrom, who);
    return own;
  };
  const holderOf = (ids: string[]): string | undefined => {
    for (const id of ids) {
      if (id === apacheId) continue;
      const line = copyrightLine(texts.get(id) ?? '');
      if (line) return line;
    }
    return undefined;
  };

  const components: Component[] = [];

  for (const pkg of [...input.npm].sort(
    (a, b) => compare(a.name, b.name) || compare(a.version, b.version),
  )) {
    const who = `${pkg.name}@${pkg.version}`;
    const override = input.overrides.packages?.[pkg.name];
    if (override) usedOverrides.add(`packages:${pkg.name}`);
    const license = override?.license ?? pkg.license;
    if (!license) {
      problems.push(
        `${who}: package.json non dichiara la licenza; indica "license" in overrides.json.`,
      );
    }
    const before = problems.length;
    const ids = resolveTexts(override, ownTexts(pkg), who);
    if (ids.length === 0 && problems.length === before) {
      problems.push(
        `${who}: nessun file LICENSE nel pacchetto; indica textPath o textFrom in overrides.json.`,
      );
    }
    components.push({
      kind: 'npm',
      name: pkg.name,
      version: pkg.version,
      license: license ?? '?',
      holder: override?.holder ?? holderOf(ids) ?? pkg.author,
      url: override?.url,
      scopes: [...pkg.scopes].sort(compare),
      texts: ids,
    });
  }

  for (const artifact of [...input.maven].sort(
    (a, b) => compare(a.group, b.group) || compare(a.name, b.name) || compare(a.version, b.version),
  )) {
    const id = `${artifact.group}:${artifact.name}`;
    const who = `${id}:${artifact.version}`;
    const overrideKey = input.overrides.artifacts?.[id]
      ? id
      : input.overrides.artifacts?.[artifact.group]
        ? artifact.group
        : undefined;
    const override = overrideKey ? input.overrides.artifacts?.[overrideKey] : undefined;
    if (overrideKey) usedOverrides.add(`artifacts:${overrideKey}`);
    const poms = artifact.poms.map(parsePom);
    const own = poms[0];
    const licensed = poms.find((pom) => pom.licenses.length > 0);

    let license = override?.license;
    if (!license) {
      if (!licensed) {
        problems.push(
          `${who}: nessun POM dichiara la licenza; indica "license" in overrides.json.`,
        );
      } else {
        const ids = licensed.licenses.map(spdxFromPom);
        const unknown = licensed.licenses.filter((_, index) => !ids[index]);
        if (unknown.length) {
          const names = unknown.map((entry) => `"${entry.name}" (${entry.url})`).join(', ');
          problems.push(
            `${who}: licenza non riconosciuta ${names}; indica "license" in overrides.json.`,
          );
        } else {
          license = [...new Set(ids as string[])].sort(compare).join(' AND ');
        }
      }
    }

    const licenseFiles = artifact.notices.filter((entry) => /LICEN[CS]E/iu.test(entry.path));
    const noticeFiles = artifact.notices.filter((entry) => /NOTICE/iu.test(entry.path));
    let ids: string[];
    if (override?.textPath || override?.textFrom) {
      ids = resolveTexts(override, [], who);
    } else if (licenseFiles.length) {
      ids = licenseFiles.map((entry) => intern(entry.text));
    } else if (license === 'Apache-2.0') {
      const apache = fromFile(APACHE_TEXT, who);
      ids = apache ? [apache] : [];
    } else {
      ids = [];
      if (license) {
        problems.push(
          `${who}: licenza ${license} senza testo nell'archivio; indica textPath o textFrom in overrides.json.`,
        );
      }
    }
    const notices = noticeFiles.map((entry) => intern(entry.text));
    components.push({
      kind: 'android',
      name: id,
      version: artifact.version,
      license: license ?? '?',
      holder:
        override?.holder ??
        holderOf(ids) ??
        holderOf(notices) ??
        own?.organization ??
        own?.developers[0] ??
        licensed?.organization ??
        licensed?.developers[0],
      url: override?.url ?? own?.url ?? licensed?.url,
      texts: ids,
      notices: notices.length ? notices : undefined,
    });
  }

  for (const font of [...(input.overrides.fonts ?? [])].sort((a, b) => compare(a.name, b.name))) {
    const who = `font ${font.name}`;
    if (!font.textPath && !font.textFrom) problems.push(`${who}: indica textPath o textFrom.`);
    if (!font.license) problems.push(`${who}: indica "license".`);
    const ids = resolveTexts(font, [], who);
    components.push({
      kind: 'font',
      name: font.name,
      license: font.license ?? '?',
      holder: font.holder ?? holderOf(ids),
      url: font.url,
      via: font.via,
      texts: ids,
    });
  }

  for (const [section, entries] of [
    ['packages', input.overrides.packages],
    ['artifacts', input.overrides.artifacts],
  ] as const) {
    for (const key of Object.keys(entries ?? {})) {
      if (!usedOverrides.has(`${section}:${key}`)) {
        problems.push(
          `override ${section}.${key} non corrisponde a nessun componente: toglilo da overrides.json.`,
        );
      }
    }
  }

  if (problems.length) throw new Error(problems.sort(compare).join('\n'));

  components.sort(
    (a, b) =>
      KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) ||
      compare(a.name, b.name) ||
      compare(a.version ?? '', b.version ?? ''),
  );

  return {
    schema: NOTICES_SCHEMA,
    summary: {
      components: components.length,
      byKind: sortedCounts(components.map((component) => component.kind)),
      byLicense: sortedCounts(components.map((component) => component.license)),
    },
    licenses: Object.fromEntries(
      [...texts].sort(([a], [b]) => compare(a, b)).map(([id, text]) => [id, { text }]),
    ),
    components,
  };
}

/** JSON con chiavi in ordine fisso e a capo finale: uguale byte per byte a parita' di input. */
export function renderNotices(notices: Notices): string {
  const components = notices.components.map((component) =>
    Object.fromEntries(
      (
        [
          'kind',
          'name',
          'version',
          'license',
          'holder',
          'url',
          'via',
          'scopes',
          'texts',
          'notices',
        ] as const
      )
        .filter((key) => component[key] !== undefined)
        .map((key) => [key, component[key]]),
    ),
  );
  return `${JSON.stringify({ ...notices, components }, null, 2)}\n`;
}

/** Differenze leggibili fra due elenchi, per il messaggio di `--check`. */
export function compareNotices(before: Notices, after: Notices): string[] {
  const key = (component: Component): string => `${component.kind} ${component.name}`;
  const previous = new Map(before.components.map((component) => [key(component), component]));
  const next = new Map(after.components.map((component) => [key(component), component]));
  const lines: string[] = [];
  for (const [id, component] of next) {
    const old = previous.get(id);
    if (!old) lines.push(`nuovo: ${id} ${component.version ?? ''} (${component.license})`);
    else if (old.version !== component.version) {
      lines.push(`versione: ${id} ${old.version ?? ''} -> ${component.version ?? ''}`);
    } else if (
      old.license !== component.license ||
      old.texts.join() !== component.texts.join() ||
      (old.notices ?? []).join() !== (component.notices ?? []).join()
    ) {
      lines.push(`licenza o testo cambiati: ${id}`);
    }
  }
  for (const id of previous.keys()) if (!next.has(id)) lines.push(`rimosso: ${id}`);
  if (!lines.length) lines.push('stessi componenti, ma file diverso: rigeneralo.');
  return lines.sort(compare);
}

/**
 * Gli avvisi delle dipendenze incorporate nell'APK, dal file che
 * `npm run notices` genera in `assets/legal/third-party-notices.json`
 * (gate 5 della nota di conformita'). Qui solo le regole pure: il file lo
 * importa `noticesFile.ts`, cosi' i test in Node lo leggono dal disco e
 * provano le stesse funzioni sul file committato.
 */

export type NoticeKind = 'android' | 'npm' | 'font';
export type NoticeScope = 'js' | 'android';

export interface NoticeComponent {
  kind: NoticeKind;
  name: string;
  version?: string;
  /** Espressione SPDX, come la scrive il generatore. */
  license: string;
  holder?: string;
  url?: string;
  /** Pacchetto o meccanismo che porta il font nell'APK. */
  via?: string;
  /** Dove un pacchetto npm entra nell'APK: nel bundle JS, come modulo nativo, o entrambi. */
  scopes?: NoticeScope[];
  /** Id dei testi di licenza in `licenses`. */
  texts: string[];
  /** Id dei file NOTICE (Apache 2.0, sezione 4d), quando l'archivio li porta. */
  notices?: string[];
}

export interface NoticesFile {
  schema: number;
  summary: {
    components: number;
    byKind: Record<string, number>;
    byLicense: Record<string, number>;
  };
  licenses: Record<string, { text: string }>;
  components: NoticeComponent[];
}

export interface IndexedComponent {
  /** Posizione in `components`: e' la chiave della route di dettaglio. */
  index: number;
  component: NoticeComponent;
}

export interface NoticeSection {
  kind: NoticeKind;
  title: string;
  data: IndexedComponent[];
}

export interface NoticeText {
  id: string;
  role: 'license' | 'notice';
  text: string;
}

const KINDS: readonly NoticeKind[] = ['android', 'npm', 'font'];

export const KIND_TITLES: Record<NoticeKind, string> = {
  android: 'Librerie Android',
  npm: 'Pacchetti npm',
  font: 'Font',
};

const KIND_WORDS: Record<NoticeKind, [singular: string, plural: string]> = {
  android: ['libreria Android', 'librerie Android'],
  npm: ['pacchetto npm', 'pacchetti npm'],
  font: ['font', 'font'],
};

/** Gli identificatori SPDX che compaiono nel file, scritti come li legge una persona. */
const SPDX_LABELS: Record<string, string> = {
  'Apache-2.0': 'Apache 2.0',
  'BSD-2-Clause': 'BSD 2-Clause',
  'BSD-3-Clause': 'BSD 3-Clause',
  'OFL-1.1': 'OFL 1.1',
};

/**
 * `(MIT AND BSD-3-Clause)` diventa «MIT e BSD 3-Clause»: le espressioni
 * composte nel file sono solo congiunzioni, il generatore non ne scrive
 * altre.
 */
export function licenseLabel(spdx: string): string {
  return spdx
    .trim()
    .replace(/^\((.*)\)$/, '$1')
    .split(/\s+AND\s+/)
    .map((id) => SPDX_LABELS[id] ?? id)
    .join(' e ');
}

/** Le sezioni dell'elenco, nell'ordine del file: librerie Android, pacchetti npm, font. */
export function sectionsByKind(file: NoticesFile): NoticeSection[] {
  const sections = KINDS.map((kind) => ({
    kind,
    title: KIND_TITLES[kind],
    data: [] as IndexedComponent[],
  }));
  file.components.forEach((component, index) => {
    sections.find((section) => section.kind === component.kind)?.data.push({ index, component });
  });
  return sections.filter((section) => section.data.length > 0);
}

/**
 * Il parametro della route di dettaglio e' la posizione nel file: ci si
 * arriva solo dall'elenco, non da link esterni, quindi non serve una chiave
 * che sopravviva a un aggiornamento delle dipendenze. Tutto cio' che non e'
 * una posizione esistente non apre niente.
 */
export function parseComponentIndex(
  id: string | string[] | undefined,
  file: NoticesFile,
): IndexedComponent | null {
  if (typeof id !== 'string' || !/^\d{1,4}$/.test(id)) return null;
  const index = Number(id);
  const component = file.components[index];
  return component ? { index, component } : null;
}

/** Prima i testi di licenza, poi i file NOTICE: gli id che il file non risolve si saltano. */
export function textsOf(file: NoticesFile, component: NoticeComponent): NoticeText[] {
  const pick = (ids: string[] | undefined, role: NoticeText['role']): NoticeText[] =>
    (ids ?? []).flatMap((id) => {
      const entry = file.licenses[id];
      return entry ? [{ id, role, text: entry.text }] : [];
    });
  return [...pick(component.texts, 'license'), ...pick(component.notices, 'notice')];
}

/** «258 componenti: 175 librerie Android, 80 pacchetti npm e 3 font». */
export function describeKinds(file: NoticesFile): string {
  const parts = KINDS.flatMap((kind) => {
    const count = file.summary.byKind[kind] ?? 0;
    return count > 0 ? [`${count} ${KIND_WORDS[kind][count === 1 ? 0 : 1]}`] : [];
  });
  const total = file.summary.components;
  const list =
    parts.length > 1 ? `${parts.slice(0, -1).join(', ')} e ${parts[parts.length - 1]}` : parts[0];
  return `${total} ${total === 1 ? 'componente' : 'componenti'}${list ? `: ${list}` : ''}`;
}

/** Le licenze per numero di componenti, dalla piu' usata: «137 Apache 2.0, 107 MIT, …». */
export function describeLicenses(file: NoticesFile): string {
  return Object.entries(file.summary.byLicense)
    .map(([spdx, count]) => ({ label: licenseLabel(spdx), count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'it'))
    .map(({ label, count }) => `${count} ${label}`)
    .join(', ');
}

/** Come il componente entra nell'APK, per la scheda di dettaglio. */
export function describeOrigin(component: NoticeComponent): string {
  switch (component.kind) {
    case 'android':
      return 'Libreria Android del classpath di release, scaricata da Gradle durante la build';
    case 'font':
      return component.via ? `Font incorporato da ${component.via}` : 'Font incorporato';
    case 'npm': {
      const js = component.scopes?.includes('js') ?? false;
      const android = component.scopes?.includes('android') ?? false;
      if (js && android) return 'Nel bundle JavaScript e come modulo nativo Android';
      if (android) return 'Modulo nativo Android, compilato durante la build';
      return 'Nel bundle JavaScript';
    }
  }
}

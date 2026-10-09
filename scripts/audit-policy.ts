/// <reference types="node" />

/**
 * La regola del controllo sulle dipendenze, separata dall'esecuzione di
 * `npm audit` per lo stesso motivo delle altre policy: si verifica in Node
 * su un rapporto finto, senza rete.
 *
 * Il controllo resta `--audit-level=high`: un avviso alto o critico lo
 * rende rosso. L'unica differenza e' che un avviso senza nessuna versione
 * corretta pubblicata si puo' accettare, ma solo per scritto: con il
 * motivo, il pacchetto e una data entro cui riguardarlo. Senza questa
 * via il controllo resterebbe rosso finche' upstream non pubblica, e un
 * controllo sempre rosso smette di accorgersi degli avvisi nuovi.
 *
 * Un'eccezione scaduta non accetta piu' niente, e una che non serve piu'
 * (l'avviso e' sparito) fa fallire il controllo finche' non la si toglie:
 * l'elenco resta corto e vero.
 */

export type Severity = 'info' | 'low' | 'moderate' | 'high' | 'critical';

/** Le severita' che rendono rosso il controllo, come `--audit-level=high`. */
export const BLOCKING_SEVERITIES: readonly Severity[] = ['high', 'critical'];

export interface Advisory {
  /** Identificativo GitHub, per esempio `GHSA-vfj7-8cjw-p6xm`. */
  id: string;
  packageName: string;
  severity: Severity;
  title: string;
  /** Versioni colpite, come le dichiara l'avviso. */
  range: string;
}

export interface AcceptedAdvisory {
  id: string;
  packageName: string;
  /** Data `AAAA-MM-GG` dopo la quale l'eccezione non vale piu'. */
  reviewBy: string;
  reason: string;
}

/**
 * Avvisi accettati, ciascuno senza una versione corretta su npm nel
 * momento in cui e' stato scritto. Prima di aggiungerne uno controlla con
 * `npm view <pacchetto> version` che l'ultima versione sia ancora colpita:
 * se esiste una correzione, la strada e' un override in package.json.
 */
export const ACCEPTED_ADVISORIES: readonly AcceptedAdvisory[] = [
  {
    id: 'GHSA-vfj7-8cjw-p6xm',
    packageName: 'braces',
    reviewBy: '2027-01-15',
    reason:
      "Nessuna versione corretta (l'ultima, 3.0.3, e' colpita). Arriva da micromatch dentro " +
      'metro-file-map, il watcher di Metro: i pattern li scrive la configurazione del progetto, ' +
      "non un input esterno, e il pacchetto non finisce nell'APK.",
  },
  {
    id: 'GHSA-86w9-cpqp-85rv',
    packageName: 'node-forge',
    reviewBy: '2027-01-15',
    reason:
      "Nessuna versione corretta (l'ultima, 1.4.0, e' colpita). In @expo/cli serve alla firma " +
      "del codice iOS e dei manifest di expo-updates: Onda e' solo Android, non usa " +
      "expo-updates, e il pacchetto non finisce nell'APK.",
  },
];

const SEVERITIES: readonly Severity[] = ['info', 'low', 'moderate', 'high', 'critical'];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** L'id GitHub sta in fondo all'URL dell'avviso; senza, resta il numero npm. */
function advisoryId(via: Record<string, unknown>): string {
  const url = typeof via.url === 'string' ? via.url : '';
  const ghsa = /GHSA(?:-[0-9a-z]{4}){3}/iu.exec(url);
  if (ghsa) return ghsa[0];
  return `npm-${String(via.source ?? 'sconosciuto')}`;
}

/**
 * Gli avvisi veri del rapporto di `npm audit --json`. Ogni pacchetto
 * elenca in `via` sia gli avvisi che lo colpiscono direttamente (oggetti)
 * sia i pacchetti vulnerabili da cui dipende (stringhe): contano solo i
 * primi, gli altri sono lo stesso avviso visto da piu' in alto.
 */
export function collectAdvisories(report: unknown): Advisory[] {
  if (!isRecord(report) || !isRecord(report.vulnerabilities)) {
    throw new Error('Il rapporto di npm audit non ha la forma attesa (manca `vulnerabilities`).');
  }

  const found = new Map<string, Advisory>();
  for (const [name, entry] of Object.entries(report.vulnerabilities)) {
    if (!isRecord(entry) || !Array.isArray(entry.via)) continue;
    for (const via of entry.via) {
      if (!isRecord(via)) continue;
      const severity = SEVERITIES.includes(via.severity as Severity)
        ? (via.severity as Severity)
        : 'critical'; // severita' ignota: si tratta come la peggiore
      const advisory: Advisory = {
        id: advisoryId(via),
        packageName: typeof via.name === 'string' ? via.name : name,
        severity,
        title: typeof via.title === 'string' ? via.title : '',
        range: typeof via.range === 'string' ? via.range : '',
      };
      // Lo stesso avviso compare una volta per ogni intervallo colpito:
      // per decidere basta una voce per avviso e pacchetto.
      found.set(`${advisory.packageName}|${advisory.id}`, advisory);
    }
  }
  return [...found.values()];
}

export interface AuditVerdict {
  ok: boolean;
  /** Avvisi alti o critici senza un'eccezione valida. */
  blocking: Advisory[];
  /** Avvisi alti o critici coperti da un'eccezione ancora valida. */
  accepted: { advisory: Advisory; exception: AcceptedAdvisory }[];
  /** Eccezioni scadute: il loro avviso e' gia' fra quelli bloccanti. */
  expired: AcceptedAdvisory[];
  /** Eccezioni che non corrispondono piu' a nessun avviso: vanno tolte. */
  unused: AcceptedAdvisory[];
}

/** `today` in formato `AAAA-MM-GG`, cosi' il confronto fra date e' fra stringhe. */
export function evaluateAudit(
  advisories: readonly Advisory[],
  exceptions: readonly AcceptedAdvisory[],
  today: string,
): AuditVerdict {
  const relevant = advisories.filter((a) => BLOCKING_SEVERITIES.includes(a.severity));
  const matches = (e: AcceptedAdvisory, a: Advisory): boolean =>
    e.id === a.id && e.packageName === a.packageName;

  const blocking: Advisory[] = [];
  const accepted: AuditVerdict['accepted'] = [];
  for (const advisory of relevant) {
    const exception = exceptions.find((e) => matches(e, advisory) && e.reviewBy >= today);
    if (exception) accepted.push({ advisory, exception });
    else blocking.push(advisory);
  }

  const expired = exceptions.filter(
    (e) => e.reviewBy < today && relevant.some((a) => matches(e, a)),
  );
  const unused = exceptions.filter((e) => !relevant.some((a) => matches(e, a)));

  return {
    ok: blocking.length === 0 && unused.length === 0,
    blocking,
    accepted,
    expired,
    unused,
  };
}

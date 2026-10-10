/**
 * Versione dello schema MMKV e migrazioni, senza dipendere da MMKV: il
 * lato piattaforma sta in `services/storage.ts`, qui c'è solo la logica,
 * che i test esercitano su una mappa in memoria.
 *
 * Regole:
 * - la versione sta in una chiave sua; senza chiave, dati presenti valgono
 *   come versione 1 (le installazioni di prima del versionamento) e un
 *   telefono vuoto parte già alla versione corrente;
 * - prima di migrare ogni chiave dei dati viene copiata in `backup.*`, un
 *   solo slot sovrascritto a ogni migrazione: se una migrazione lancia, i
 *   dati tornano com'erano e la versione non avanza. La cache no: si rifa'
 *   dalla rete, e se una migrazione fallisce si butta;
 * - una versione più nuova della nostra (app tornata indietro) non si tocca:
 *   i loader sono tolleranti e il dato resta intatto per la versione giusta;
 * - un valore illeggibile non si cancella: finisce in `quarantine.*`.
 */

import { isPersistedQuery, withoutSessionOnly } from './queryPersistenceSchema';

export interface KeyValue {
  get(key: string): string | undefined;
  set(key: string, value: string): void;
  delete(key: string): void;
  keys(): string[];
}

export const STORAGE_VERSION = 4;
export const VERSION_KEY = 'schema.version';
export const BACKUP_PREFIX = 'backup.';
export const QUARANTINE_PREFIX = 'quarantine.';

/** Le chiavi dei dati dell'app: quelle che si salvano prima di migrare. */
export const DATA_KEYS: readonly string[] = [
  'library.v1',
  'playback.v1',
  'search.recent.v1',
  'session.queue.v1',
  'session.position.v1',
];

/**
 * La cache di React Query. Si rifa' dalla rete, quindi non ha backup; e non
 * deve averne, perche' i dati Audius vi sono ammessi solo per la sessione
 * e una copia in `backup.*` le sopravvivrebbe.
 */
export const CACHE_KEYS: readonly string[] = ['query-cache.v1'];

interface Migration {
  /** Versione raggiunta dopo la migrazione. */
  to: number;
  describe: string;
  run(kv: KeyValue): void;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function readValue(kv: KeyValue, key: string): unknown {
  const raw = kv.get(key);
  if (raw === undefined) return undefined;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
}

const MIGRATIONS: readonly Migration[] = [
  {
    to: 2,
    describe: 'playback.v1: repeat numerico (0/1/2) → off/one/all',
    run(kv) {
      const saved = readValue(kv, 'playback.v1');
      if (!isRecord(saved) || typeof saved.repeat !== 'number') return;
      const repeat = (['off', 'one', 'all'] as const)[saved.repeat] ?? 'off';
      kv.set('playback.v1', JSON.stringify({ ...saved, repeat }));
    },
  },
  {
    to: 3,
    describe: "query-cache.v1: via gli elenchi a scorrimento salvati con l'offset unico",
    /**
     * Le pagine scritte prima del cursore per sorgente non portano il
     * cursore della successiva: rilette cosi', lo scroll infinito si
     * fermerebbe finche' la rete non le rinfresca. Si tolgono solo le query
     * a pagine (quelle con `pageParams`); profili, album e vetrine restano,
     * e gli elenchi tolti si ricaricano dalla rete al primo avvio.
     */
    run(kv) {
      const saved = readValue(kv, 'query-cache.v1');
      if (!isRecord(saved) || !Array.isArray(saved.queries)) return;
      const paged = (q: unknown): boolean =>
        isRecord(q) &&
        isRecord(q.state) &&
        isRecord(q.state.data) &&
        Array.isArray(q.state.data.pageParams);
      const queries = saved.queries.filter((q) => !paged(q));
      if (queries.length === saved.queries.length) return;
      kv.set('query-cache.v1', JSON.stringify({ ...saved, queries }));
    },
  },
  {
    to: 4,
    describe: 'query-cache.v1: via i dati Audius, ammessi solo in una cache di sessione',
    /**
     * Da qui la cache non li scrive piu' (`withoutSessionOnly`): la
     * migrazione toglie quelli scritti prima, con la stessa regola. La
     * copia in `backup.*` la toglie `backup()`, che non salva piu' la cache.
     */
    run(kv) {
      const saved = readValue(kv, 'query-cache.v1');
      if (!isRecord(saved) || !Array.isArray(saved.queries)) return;
      let changed = false;
      const queries = saved.queries.flatMap((q: unknown) => {
        // Una voce rotta resta: la scarta la lettura, come sempre.
        if (!isPersistedQuery(q)) return [q];
        const kept = withoutSessionOnly(q);
        if (kept !== q) changed = true;
        return kept ? [kept] : [];
      });
      if (changed) kv.set('query-cache.v1', JSON.stringify({ ...saved, queries }));
    },
  },
];

export function readStorageVersion(kv: KeyValue): number {
  const raw = kv.get(VERSION_KEY);
  if (raw !== undefined) {
    const n = Number(raw);
    if (Number.isInteger(n) && n >= 1) return n;
  }
  return [...DATA_KEYS, ...CACHE_KEYS].some((key) => kv.get(key) !== undefined)
    ? 1
    : STORAGE_VERSION;
}

export type MigrationOutcome = 'current' | 'upgraded' | 'newer' | 'failed';

export interface MigrationReport {
  outcome: MigrationOutcome;
  from: number;
  to: number;
  applied: string[];
  error?: string;
}

function backup(kv: KeyValue, version: number): void {
  for (const key of DATA_KEYS) {
    const raw = kv.get(key);
    if (raw === undefined) kv.delete(BACKUP_PREFIX + key);
    else kv.set(BACKUP_PREFIX + key, raw);
  }
  // Fino alla versione 3 la cache finiva nel backup: quella copia va via.
  for (const key of CACHE_KEYS) kv.delete(BACKUP_PREFIX + key);
  kv.set(BACKUP_PREFIX + 'version', String(version));
}

function restore(kv: KeyValue): void {
  for (const key of DATA_KEYS) {
    const raw = kv.get(BACKUP_PREFIX + key);
    if (raw === undefined) kv.delete(key);
    else kv.set(key, raw);
  }
  // Una cache migrata a meta' non si ripristina: si butta e si rifa'.
  for (const key of CACHE_KEYS) kv.delete(key);
}

/** Porta lo storage alla versione corrente. Idempotente: la seconda volta non fa niente. */
export function migrateStorage(kv: KeyValue): MigrationReport {
  const from = readStorageVersion(kv);
  if (from > STORAGE_VERSION) return { outcome: 'newer', from, to: from, applied: [] };
  if (from === STORAGE_VERSION) {
    if (kv.get(VERSION_KEY) === undefined) kv.set(VERSION_KEY, String(STORAGE_VERSION));
    return { outcome: 'current', from, to: from, applied: [] };
  }

  backup(kv, from);
  const applied: string[] = [];
  let version = from;
  try {
    for (const migration of MIGRATIONS) {
      if (migration.to <= version) continue;
      migration.run(kv);
      applied.push(migration.describe);
      version = migration.to;
    }
  } catch (error) {
    restore(kv);
    return {
      outcome: 'failed',
      from,
      to: from,
      applied,
      error: error instanceof Error ? error.message : String(error),
    };
  }
  kv.set(VERSION_KEY, String(version));
  return { outcome: 'upgraded', from, to: version, applied };
}

/**
 * Mette da parte un valore che non si riesce a leggere, invece di
 * cancellarlo: per chi vuole capire cosa è successo, e per non buttare
 * una libreria per un byte troncato.
 */
export function quarantine(kv: KeyValue, key: string, raw: string): void {
  kv.set(QUARANTINE_PREFIX + key, raw);
  kv.delete(key);
}

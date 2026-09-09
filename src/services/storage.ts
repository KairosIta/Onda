import { MMKV } from 'react-native-mmkv';
import { type KeyValue, migrateStorage, quarantine } from './storageSchema';

/**
 * Storage locale, sincrono. Niente account, niente rete: tutto quello
 * che l'utente salva resta sul telefono.
 *
 * MMKV 3.x gira sulla new architecture (Nitro Modules), che e' quella
 * abilitata in app.json. Serve una dev build: non funziona in Expo Go.
 */
export const storage = new MMKV({ id: 'onda' });

const kv: KeyValue = {
  get: (key) => storage.getString(key),
  set: (key, value) => storage.set(key, value),
  delete: (key) => storage.delete(key),
  keys: () => storage.getAllKeys(),
};

/**
 * Prima di qualunque store: i moduli che leggono lo storage importano
 * questo file, quindi la migrazione e' gia' passata quando parsano.
 */
export const migrationReport = migrateStorage(kv);
if (migrationReport.outcome === 'upgraded') {
  console.info(
    `[storage] schema ${migrationReport.from} → ${migrationReport.to}: ${migrationReport.applied.join('; ')}`,
  );
} else if (migrationReport.outcome === 'failed') {
  console.warn(`[storage] migrazione fallita, dati ripristinati: ${migrationReport.error}`);
}

export function readJSON(key: string): unknown {
  const raw = storage.getString(key);
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    // Dato illeggibile: in quarantena, non nel cestino. L'app riparte da
    // zero per quella chiave ma il valore resta li' per capire cos'e' stato.
    quarantine(kv, key, raw);
    return undefined;
  }
}

export function writeJSON(key: string, value: unknown): void {
  storage.set(key, JSON.stringify(value));
}

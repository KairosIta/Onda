import { MMKV } from 'react-native-mmkv';

/**
 * Storage locale, sincrono. Niente account, niente rete: tutto quello
 * che l'utente salva resta sul telefono.
 *
 * MMKV 3.x gira sulla new architecture (Nitro Modules), che e' quella
 * abilitata in app.json. Serve una dev build: non funziona in Expo Go.
 */
export const storage = new MMKV({ id: 'onda' });

export function readJSON(key: string): unknown {
  const raw = storage.getString(key);
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    // Dato corrotto: meglio ripartire da zero che crashare all'avvio.
    storage.delete(key);
    return undefined;
  }
}

export function writeJSON(key: string, value: unknown): void {
  storage.set(key, JSON.stringify(value));
}

import type { SourceId } from '@/types/track';

export const ARTWORK_CACHE_POLICY_VERSION = 1;

/**
 * Se il disco si puo' usare per le copertine Jamendo. Lo decide
 * `prepareArtworkCache` all'avvio: finche' la vecchia cache mista non e'
 * stata eliminata, tutte le copertine restano in memoria. Le schermate si
 * montano solo dopo quella decisione; i test la impostano direttamente.
 */
let diskReady = true;

export const setArtworkDiskReady = (ready: boolean): void => {
  diskReady = ready;
};

export const isArtworkDiskReady = (): boolean => diskReady;

export function artworkCachePolicy(
  source: SourceId | undefined,
  disk = diskReady,
): 'memory' | 'memory-disk' {
  return source === 'jamendo' && disk ? 'memory-disk' : 'memory';
}

/** Anche a URL uguale una sorgente non riusa la cache dell'altra. */
export const artworkCacheKey = (source: SourceId | undefined, uri: string): string =>
  `onda:artwork:${source ?? 'unknown'}:${uri}`;

/**
 * L'aggiornamento della policy deve eliminare anche la cache gia' presente.
 * Ritorna se il disco si puo' usare: `true` se la cancellazione e' gia'
 * avvenuta o riesce adesso, `false` se fallisce. Un fallimento non ferma
 * l'app, che non ne ha bisogno per suonare: le copertine restano in memoria
 * e si ritenta al prossimo avvio, perche' la versione non avanza. expo-image
 * risponde `false` anche solo quando non ha un'Activity sotto mano.
 */
export async function migrateArtworkCache(
  version: number | undefined,
  clearDisk: () => Promise<boolean>,
  saveVersion: (version: number) => void,
): Promise<boolean> {
  if (version === ARTWORK_CACHE_POLICY_VERSION) return true;
  let cleared = false;
  try {
    cleared = await clearDisk();
  } catch {
    cleared = false;
  }
  if (cleared) saveVersion(ARTWORK_CACHE_POLICY_VERSION);
  return cleared;
}

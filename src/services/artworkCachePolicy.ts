import type { SourceId } from '@/types/track';

export const ARTWORK_CACHE_POLICY_VERSION = 1;

export function artworkCachePolicy(source: SourceId | undefined): 'memory' | 'memory-disk' {
  return source === 'jamendo' ? 'memory-disk' : 'memory';
}

/** Anche a URL uguale una sorgente non riusa la cache dell'altra. */
export const artworkCacheKey = (source: SourceId | undefined, uri: string): string =>
  `onda:artwork:${source ?? 'unknown'}:${uri}`;

/** L'aggiornamento della policy deve eliminare anche la cache gia' presente. */
export async function migrateArtworkCache(
  version: number | undefined,
  clearDisk: () => Promise<boolean>,
  saveVersion: (version: number) => void,
): Promise<void> {
  if (version === ARTWORK_CACHE_POLICY_VERSION) return;
  if (!(await clearDisk())) {
    throw new Error('Non riesco a rimuovere la vecchia cache delle copertine. Riprova.');
  }
  saveVersion(ARTWORK_CACHE_POLICY_VERSION);
}

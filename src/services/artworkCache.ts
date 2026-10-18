import { Image } from 'expo-image';
import { migrateArtworkCache } from './artworkCachePolicy';
import { storage } from './storage';

const KEY = 'artwork-cache.policy-version';
let preparation: Promise<void> | null = null;

/** Prima di montare le immagini: elimina una volta la cache della vecchia policy. */
export function prepareArtworkCache(): Promise<void> {
  if (!preparation) {
    preparation = migrateArtworkCache(
      storage.getNumber(KEY),
      () => Image.clearDiskCache(),
      (version) => storage.set(KEY, version),
    ).catch((error) => {
      preparation = null;
      throw error;
    });
  }
  return preparation;
}

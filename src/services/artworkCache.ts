import { Image } from 'expo-image';
import { migrateArtworkCache, setArtworkDiskReady } from './artworkCachePolicy';
import { storage } from './storage';

const KEY = 'artwork-cache.policy-version';
let preparation: Promise<void> | null = null;

/**
 * Prima di montare le immagini: elimina una volta la cache della vecchia
 * policy. Non fallisce mai: se la cancellazione non riesce, le copertine
 * restano in memoria per questa sessione e si ritenta al prossimo avvio.
 */
export function prepareArtworkCache(): Promise<void> {
  if (!preparation) {
    preparation = migrateArtworkCache(
      storage.getNumber(KEY),
      () => Image.clearDiskCache(),
      (version) => storage.set(KEY, version),
    ).then((ready) => {
      setArtworkDiskReady(ready);
      if (!ready) {
        console.warn(
          '[artwork] vecchia cache non rimossa: copertine solo in memoria fino al prossimo avvio',
        );
      }
    });
  }
  return preparation;
}

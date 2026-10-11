/**
 * Nei test in Node mette al posto dei moduli nativi i loro doppi in
 * memoria (`scripts/doubles/`): il player, AppState, MMKV e il Keystore.
 * Cosi' si provano in Node anche gli store e i servizi che parlano con il
 * player. Lo carica solo `npm test`, dopo `node-hook.mjs`: risolve per
 * primo e lascia a lui alias ed estensioni. Lo smoke usa i moduli veri.
 */
import { registerHooks } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const double = (file) => pathToFileURL(path.join(HERE, 'doubles', file)).href;

/** Pacchetti che fuori da React Native non si caricano. */
const PACKAGES = {
  'react-native': double('react-native.ts'),
  'react-native-mmkv': double('mmkv.ts'),
  'expo-secure-store': double('secure-store.ts'),
};

/** Il collegamento al modulo nativo: al suo posto il player finto, dietro la stessa facciata. */
const NATIVE_BACKEND = pathToFileURL(path.join(HERE, '..', 'src', 'player', 'media3.ts')).href;

registerHooks({
  resolve(specifier, context, next) {
    if (Object.hasOwn(PACKAGES, specifier)) {
      return { url: PACKAGES[specifier], shortCircuit: true };
    }
    const resolved = next(specifier, context);
    return resolved.url === NATIVE_BACKEND ? { ...resolved, url: double('player.ts') } : resolved;
  },
});

/**
 * La versione della cache di Metro per un dato ambiente.
 *
 * babel-preset-expo scrive i valori `EXPO_PUBLIC_*` dentro il codice
 * trasformato, ma la chiave della cache di Metro non li considera: dopo un
 * cambio del Client ID in `.env` il bundle successivo riusava le
 * trasformazioni con il valore vecchio, e l'APK lo portava senza avvisi.
 *
 * `cacheVersion` entra nella chiave globale della cache delle
 * trasformazioni. Con un'impronta dei valori `EXPO_PUBLIC_*` dentro, la
 * cache si rinnova quando cambiano e resta valida quando sono uguali, senza
 * svuotare la cartella condivisa con gli altri progetti. Si usa l'impronta
 * e non i valori, che cosi' non finiscono in nessun file della cache.
 *
 * CommonJS come build-provenance.cjs: lo carica metro.config.js, che Expo
 * legge senza transpilare. I tipi stanno in metro-cache-version.d.cts.
 */

const { createHash } = require('node:crypto');

const PUBLIC_PREFIX = 'EXPO_PUBLIC_';

/**
 * @param {Record<string, string | undefined>} env
 * @param {string} [base] la `cacheVersion` della configurazione di partenza
 * @returns {string}
 */
function metroCacheVersion(env, base = '1.0') {
  const entries = Object.keys(env)
    .filter((key) => key.startsWith(PUBLIC_PREFIX))
    .sort()
    .map((key) => `${key}=${env[key] ?? ''}`);
  const digest = createHash('sha256').update(entries.join('\n')).digest('hex').slice(0, 16);
  return `${base}+env-${digest}`;
}

module.exports = { metroCacheVersion };

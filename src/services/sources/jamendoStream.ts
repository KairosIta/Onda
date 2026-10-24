/**
 * Gli URL di stream di Jamendo portano il Client ID dell'applicazione nel
 * parametro `from` (`from=app-<client_id>`): e' cosi' che Jamendo attribuisce
 * gli ascolti all'app registrata. Il Client ID e' pero' personale e sta nel
 * Keystore, non in MMKV, nell'export della libreria o nella cache: qui si
 * toglie dagli URL che si salvano e si rimette, con il valore corrente, solo
 * nell'URL consegnato al player.
 *
 * Modulo puro, senza `URL`: React Native non implementa `URLSearchParams`
 * per intero, e un URL che non si riesce a leggere resta com'e'.
 */

/**
 * Solo lettere, cifre e trattini nelle etichette dell'host: una barra
 * rovesciata o una chiocciola davanti a `jamendo.com`, che alcuni parser
 * leggono come fine dell'host, non devono far passare un host estraneo, a
 * cui finirebbe il Client ID.
 */
const JAMENDO_HOST = /^https?:\/\/(?:[a-z0-9-]+\.)*jamendo\.com(?=[/?#]|$)/iu;
const APP_TAG = /^from=/iu;

export const isJamendoUrl = (url: string): boolean => JAMENDO_HOST.test(url);

/** L'URL senza il parametro `from`: quello che si puo' salvare. */
export function stripJamendoAppTag(url: string): string {
  if (!isJamendoUrl(url)) return url;
  const at = url.indexOf('?');
  if (at < 0) return url;
  const kept = url
    .slice(at + 1)
    .split('&')
    .filter((part) => part !== '' && !APP_TAG.test(part));
  return url.slice(0, at) + (kept.length > 0 ? `?${kept.join('&')}` : '');
}

/** L'URL con cui si suona: il Client ID corrente al posto di quello salvato. */
export function tagJamendoStream(url: string, clientId: string): string {
  const clean = stripJamendoAppTag(url);
  if (!clientId || !isJamendoUrl(clean)) return clean;
  const separator = clean.includes('?') ? '&' : '?';
  return `${clean}${separator}from=app-${encodeURIComponent(clientId)}`;
}

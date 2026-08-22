/**
 * Le variabili con prefisso EXPO_PUBLIC_ vengono inlinate nel bundle a
 * build time. Per un'app privata va benissimo. Se un giorno la pubblichi,
 * il client_id Jamendo deve sparire da qui e finire dietro un proxy.
 */

export const JAMENDO_CLIENT_ID = process.env.EXPO_PUBLIC_JAMENDO_CLIENT_ID ?? '';
export const AUDIUS_APP_NAME = process.env.EXPO_PUBLIC_AUDIUS_APP_NAME ?? 'Onda';

export function assertEnv(): string | null {
  if (!JAMENDO_CLIENT_ID) {
    return 'Manca EXPO_PUBLIC_JAMENDO_CLIENT_ID. Copia .env.example in .env e riavvia il bundler.';
  }
  return null;
}

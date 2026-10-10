import * as SecureStore from 'expo-secure-store';
import type { Credentials } from './sourceSettings';

/**
 * Le credenziali che la persona inserisce in app: Client ID Jamendo e API
 * key Audius. Stanno in expo-secure-store, cifrate con una chiave del
 * Keystore Android, e non in MMKV con il resto: Jamendo le vuole
 * «strettamente personali» e conservate in modo sicuro.
 *
 * Restano fuori dal backup Android (il plugin di expo-secure-store ha
 * `configureAndroidBackup: false`, e il backup di Onda e' disabilitato), da
 * export, log e URL salvati. Si cancellano con l'app o dalla schermata
 * Sorgenti.
 *
 * La lettura e' sincrona, una volta all'avvio: le sorgenti chiedono la
 * credenziale a ogni richiesta, e la memoria risponde senza toccare il
 * Keystore. Vale anche per il gestore headless, che gira nello stesso
 * runtime.
 */

const KEYS: Record<keyof Credentials, string> = {
  jamendoClientId: 'onda.jamendo.client-id',
  audiusApiKey: 'onda.audius.api-key',
};

/**
 * Una chiave del Keystore invalidata (per esempio dopo un cambio del blocco
 * schermo su alcuni telefoni) rende il valore illeggibile: si scarta, e la
 * schermata Sorgenti chiede di reinserirlo.
 */
function readOne(name: keyof Credentials): string {
  try {
    return SecureStore.getItem(KEYS[name]) ?? '';
  } catch {
    SecureStore.deleteItemAsync(KEYS[name]).catch(() => {});
    return '';
  }
}

let current: Credentials = {
  jamendoClientId: readOne('jamendoClientId'),
  audiusApiKey: readOne('audiusApiKey'),
};

const listeners = new Set<() => void>();

export const getStoredCredentials = (): Credentials => current;

export const subscribeCredentials = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/**
 * Salva o, con un valore vuoto, cancella. Lancia se il Keystore rifiuta la
 * scrittura: chi chiama lo dice a schermo invece di fingere un salvataggio.
 */
export function saveCredential(name: keyof Credentials, value: string): void {
  if (value) {
    SecureStore.setItem(KEYS[name], value);
  } else {
    SecureStore.deleteItemAsync(KEYS[name]).catch(() => {});
  }
  current = { ...current, [name]: value };
  listeners.forEach((l) => l());
}

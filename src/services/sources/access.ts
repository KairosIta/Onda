import { type Credentials, NO_CREDENTIALS } from '@/services/sourceSettings';
import type { SourceId } from '@/types/track';

/**
 * Come le sorgenti sanno se sono accese e con quali credenziali, senza
 * importare Keystore e MMKV: li collega l'app all'avvio (`store/sources`),
 * e i test in Node ne passano di finti.
 *
 * Finche' nessuno li collega non lavora nessuna sorgente: meglio una
 * schermata vuota che una richiesta partita senza le credenziali giuste.
 */
export interface SourceAccess {
  credentials(): Credentials;
  isActive(id: SourceId): boolean;
}

export const NO_ACCESS: SourceAccess = {
  credentials: () => NO_CREDENTIALS,
  isActive: () => false,
};

let access: SourceAccess = NO_ACCESS;

export function setSourceAccess(next: SourceAccess): void {
  access = next;
}

/** Lette a ogni richiesta, non all'avvio: una credenziale cambiata vale subito. */
export const currentCredentials = (): Credentials => access.credentials();

export const isSourceAvailable = (id: SourceId): boolean => access.isActive(id);

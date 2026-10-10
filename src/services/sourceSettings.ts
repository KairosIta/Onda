/**
 * Le scelte dell'utente sulle sorgenti e le regole sulle credenziali,
 * senza dipendere da MMKV ne' dal Keystore: qui la logica, che i test
 * verificano in Node. Il lato piattaforma sta in `services/credentials`
 * (Keystore) e `store/sources` (interruttori su MMKV).
 *
 * Onda non incorpora credenziali: ogni persona inserisce le proprie in
 * app. Jamendo non parte senza un Client ID; Audius funziona senza niente
 * e accetta una API key facoltativa.
 */

import { SOURCE_IDS, type SourceId } from '@/types/track';

export interface Credentials {
  /** Client ID dell'applicazione registrata dall'utente sul portale Jamendo. */
  jamendoClientId: string;
  /** API key Audius dell'utente: facoltativa, alza i limiti di richieste. */
  audiusApiKey: string;
}

export const NO_CREDENTIALS: Credentials = { jamendoClientId: '', audiusApiKey: '' };

/**
 * La credenziale senza la quale una sorgente non parte, se ne ha una.
 * Una tabella per sorgente, cosi' una sorgente nuova non la puo' saltare.
 */
export const REQUIRED_CREDENTIAL: Record<SourceId, keyof Credentials | null> = {
  audius: null,
  jamendo: 'jamendoClientId',
};

export interface SourceSettings {
  /** L'interruttore di ogni sorgente. Acceso non basta a chi vuole una credenziale. */
  enabled: Record<SourceId, boolean>;
  /** La schermata di benvenuto e' stata completata o saltata. */
  welcomeDone: boolean;
  /** L'invito in Scopri a configurare Jamendo e' stato chiuso. */
  jamendoInviteDismissed: boolean;
}

export const DEFAULT_SOURCE_SETTINGS: SourceSettings = {
  enabled: { audius: true, jamendo: true },
  welcomeDone: false,
  jamendoInviteDismissed: false,
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Rilegge da MMKV con tolleranza: un campo mancante o rotto vale il suo default. */
export function loadSourceSettings(value: unknown): SourceSettings {
  if (!isRecord(value)) return DEFAULT_SOURCE_SETTINGS;
  const saved = isRecord(value.enabled) ? value.enabled : {};
  const enabled = Object.fromEntries(
    SOURCE_IDS.map((id) => [
      id,
      typeof saved[id] === 'boolean' ? saved[id] : DEFAULT_SOURCE_SETTINGS.enabled[id],
    ]),
  ) as Record<SourceId, boolean>;
  return {
    enabled,
    welcomeDone: value.welcomeDone === true,
    jamendoInviteDismissed: value.jamendoInviteDismissed === true,
  };
}

export const hasRequiredCredential = (id: SourceId, credentials: Credentials): boolean => {
  const required = REQUIRED_CREDENTIAL[id];
  return required === null || credentials[required] !== '';
};

/** Una sorgente lavora se e' accesa e ha cio' che le serve. */
export const isSourceActive = (
  id: SourceId,
  settings: SourceSettings,
  credentials: Credentials,
): boolean => settings.enabled[id] && hasRequiredCredential(id, credentials);

/**
 * L'invito in Scopri: per chi ha saltato il benvenuto senza Jamendo, finche'
 * non lo configura o non lo chiude.
 */
export const showJamendoInvite = (settings: SourceSettings, credentials: Credentials): boolean =>
  settings.welcomeDone && !settings.jamendoInviteDismissed && credentials.jamendoClientId === '';

/** Un valore incollato porta spesso spazi o un a capo: nessuna credenziale ne contiene. */
export const normalizeCredential = (input: string): string => input.replace(/\s+/gu, '');

const PLACEHOLDER = /(inserisci|changeme|replace[_ -]?me|your[_ -]|example|client[_ -]?id)/iu;

/** Il motivo per cui il testo non puo' essere un Client ID, o `null` se puo' esserlo. */
export function jamendoClientIdProblem(input: string): string | null {
  const value = normalizeCredential(input);
  if (!value) return 'Inserisci il Client ID.';
  if (PLACEHOLDER.test(value)) return 'Questo è un testo di esempio, non un Client ID.';
  if (!/^[A-Za-z0-9_-]{4,64}$/u.test(value)) {
    return 'Il Client ID contiene solo lettere e numeri: controlla di averlo copiato intero.';
  }
  return null;
}

/** Il valore salvato a schermo: abbastanza per riconoscerlo, non per copiarlo. */
export function maskCredential(value: string): string {
  return value.length > 4 ? `••••${value.slice(-4)}` : '••••';
}

/**
 * L'esito di una verifica del Client ID con una richiesta a Jamendo. I
 * codici sono quelli della documentazione Jamendo: 5 Client ID non valido,
 * 6 limite di richieste superato, 11 applicazione sospesa.
 */
export type JamendoCheck =
  'ok' | 'invalid' | 'rate-limited' | 'suspended' | 'unreachable' | 'error';

/** Jamendo risponde 200 anche sugli errori: lo stato vero sta in `headers`. */
export function jamendoCheckFromResponse(json: unknown): JamendoCheck {
  const headers = isRecord(json) && isRecord(json.headers) ? json.headers : {};
  if (headers.status === 'success') return 'ok';
  switch (Number(headers.code)) {
    case 5:
      return 'invalid';
    case 6:
      return 'rate-limited';
    case 11:
      return 'suspended';
    default:
      return 'error';
  }
}

export const JAMENDO_CHECK_MESSAGES: Record<JamendoCheck, string> = {
  ok: 'Client ID valido: Jamendo è attivo.',
  invalid: 'Jamendo non riconosce questo Client ID. Controlla di averlo copiato intero.',
  'rate-limited':
    'Il Client ID è valido, ma ha superato il limite di richieste: Jamendo tornerà disponibile più tardi.',
  suspended:
    'Jamendo ha sospeso l’applicazione di questo Client ID. Controlla sul portale sviluppatori.',
  unreachable: 'Non riesco a raggiungere Jamendo per verificarlo: controlla la rete.',
  error: 'Jamendo ha risposto con un errore inatteso.',
};

/**
 * Lo stesso esito quando arriva durante l'uso, dentro l'avviso «Jamendo non
 * risponde: …»: dice dove intervenire. Gli altri errori restano quelli di
 * Jamendo.
 */
export const JAMENDO_FAILURE_MESSAGES: Partial<Record<JamendoCheck, string>> = {
  invalid: 'Client ID non valido, controllalo in Libreria › Sorgenti',
  'rate-limited': 'limite di richieste del Client ID superato, riprova più tardi',
  suspended: 'applicazione sospesa da Jamendo, controlla il Client ID in Libreria › Sorgenti',
};

/**
 * Cosa fare dopo la verifica, prima di salvare. Un ID che Jamendo rifiuta
 * non si salva; uno valido si', anche oltre la quota, che passa da sola.
 * Senza una risposta non si sa: decide la persona.
 */
export function afterJamendoCheck(check: JamendoCheck): 'save' | 'refuse' | 'ask' {
  if (check === 'ok' || check === 'rate-limited') return 'save';
  if (check === 'invalid' || check === 'suspended') return 'refuse';
  return 'ask';
}

/** Il problema dell'API key Audius incollata, o `null`. */
export function audiusApiKeyProblem(input: string): string | null {
  const value = normalizeCredential(input);
  if (!value) return 'Inserisci la API key.';
  if (/^bearer/iu.test(value)) {
    return 'Questo sembra un Bearer token: serve la API key, mai il token o il Secret.';
  }
  if (!/^[A-Za-z0-9_-]{8,128}$/u.test(value)) {
    return 'La API key contiene solo lettere e numeri: controlla di averla copiata intera.';
  }
  return null;
}

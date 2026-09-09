/**
 * Le regole del permesso notifiche, senza React Native: chi lo chiede, quando
 * e cosa proporre a chi lo ha negato. Il lato piattaforma sta in
 * `store/notificationPermission.ts`.
 *
 * Da Android 13 (API 33) la notifica del player non compare senza permesso e
 * nessuno lo segnala: si vede solo che "non funziona". Chiederlo all'avvio,
 * prima che la persona abbia premuto play, non spiega niente e viene negato
 * per riflesso.
 */

export type NotificationPermission =
  /** Non ancora controllato. */
  | 'unknown'
  /** Piattaforma senza permesso a runtime: niente da chiedere. */
  | 'unnecessary'
  | 'granted'
  /** Negato, ma il sistema mostrerebbe ancora la finestra. */
  | 'denied'
  /** «Non chiedere più» o negato due volte: si sblocca solo dalle impostazioni. */
  | 'blocked';

export type RequestResult = 'granted' | 'denied' | 'never_ask_again';

/** Solo Android 13+ ha il permesso a runtime `POST_NOTIFICATIONS`. */
export function notificationPermissionRequired(os: string, version: number | string): boolean {
  return os === 'android' && Number(version) >= 33;
}

export function statusFromRequest(result: RequestResult): NotificationPermission {
  switch (result) {
    case 'granted':
      return 'granted';
    case 'never_ask_again':
      return 'blocked';
    default:
      return 'denied';
  }
}

/**
 * `check` dice solo sì o no: un no dopo un «non chiedere più» resta bloccato,
 * un no senza storia è un semplice negato.
 */
export function statusFromCheck(
  granted: boolean,
  previous: NotificationPermission,
): NotificationPermission {
  if (granted) return 'granted';
  return previous === 'blocked' ? 'blocked' : 'denied';
}

/** Vale la pena mostrare la finestra di sistema? */
export function shouldRequest(status: NotificationPermission): boolean {
  return status === 'unknown' || status === 'denied';
}

export type NotificationRemedy =
  { kind: 'request'; label: 'Consenti' } | { kind: 'settings'; label: 'Impostazioni' };

/**
 * Cosa offrire accanto all'avviso: finché il sistema chiede ancora, si può
 * richiedere; una volta bloccato resta solo la pagina dell'app nelle
 * impostazioni.
 */
export function notificationRemedy(status: NotificationPermission): NotificationRemedy | null {
  switch (status) {
    case 'denied':
      return { kind: 'request', label: 'Consenti' };
    case 'blocked':
      return { kind: 'settings', label: 'Impostazioni' };
    default:
      return null;
  }
}

/**
 * Il selettore di cartelle di expo-file-system segnala l'annullamento
 * rigettando, non con un risultato: un ripensamento va distinto da un
 * guasto, perche' all'utente non si mostra un errore per aver premuto
 * Indietro. Expo ricava il codice dal nome della classe Kotlin
 * (`PickerCancelledException` → `ERR_PICKER_CANCELLED`) e lo propaga
 * anche quando incarta l'eccezione in «Call to function … has been
 * rejected. → Caused by: …»; si guarda comunque anche il messaggio e la
 * catena delle cause, perche' la forma dell'errore e' cambiata fra una
 * versione e l'altra e un annullamento scambiato per errore e' gia' successo.
 */

const PICKER_CANCELLED = 'ERR_PICKER_CANCELLED';
const CANCELLED_MESSAGE = /picker was cancelled|PICKER_CANCELLED/iu;

export function isPickerCancelled(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && typeof current === 'object' && current !== null; depth++) {
    const { code, message, cause } = current as {
      code?: unknown;
      message?: unknown;
      cause?: unknown;
    };
    if (code === PICKER_CANCELLED) return true;
    if (typeof message === 'string' && CANCELLED_MESSAGE.test(message)) return true;
    current = cause;
  }
  return false;
}

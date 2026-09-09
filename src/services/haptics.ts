import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * Feedback tattile, tutto in un punto.
 *
 * Passa dalle costanti di sistema (`performHapticFeedback`) e non da un
 * pattern di vibrazione nostro: cosi' la risposta e' la stessa che il
 * telefono da' alle proprie interfacce e rispetta l'impostazione
 * "Vibrazione al tocco" dell'utente. Un dispositivo senza motore o con il
 * feedback spento non e' un errore: si tace.
 *
 * Le costanti piu' espressive esistono solo da Android 11 (Confirm, Reject,
 * Gesture_End) o 14 (Toggle): sotto, si ricade sul click di contesto, che
 * c'e' dovunque. Le schermate chiamano questo modulo, mai expo-haptics.
 */

const API = Platform.OS === 'android' ? Number(Platform.Version) : 0;
const A = Haptics.AndroidHaptics;

function perform(kind: Haptics.AndroidHaptics): void {
  if (Platform.OS !== 'android') return;
  Haptics.performAndroidHapticsAsync(kind).catch(() => {});
}

const since = (
  api: number,
  preferred: Haptics.AndroidHaptics,
  fallback: Haptics.AndroidHaptics = A.Context_Click,
): Haptics.AndroidHaptics => (API >= api ? preferred : fallback);

export const haptics = {
  /** Tocco leggero: play/pausa, chip, bottoni, avvio di un brano. */
  tap: (): void => perform(A.Context_Click),
  /** Interruttore che cambia stato: preferito, shuffle, ripetizione. */
  toggle: (on: boolean): void => perform(since(34, on ? A.Toggle_On : A.Toggle_Off)),
  /** Pressione lunga: apertura del menu contestuale. */
  longPress: (): void => perform(A.Long_Press),
  /** Azione riuscita: accodata, aggiunta a una playlist, libreria salvata. */
  success: (): void => perform(since(30, A.Confirm)),
  /** Azione distruttiva confermata o richiesta rifiutata. */
  reject: (): void => perform(since(30, A.Reject, A.Long_Press)),
  /** Gesto concluso: il player chiuso con il trascinamento. */
  gestureEnd: (): void => perform(since(30, A.Gesture_End)),
};

/** Feedback senza argomenti, quelli che un bottone puo' dichiarare come prop. */
export type HapticKind = Exclude<keyof typeof haptics, 'toggle'>;

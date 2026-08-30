import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { buildExport, parseExport, type ParseResult } from '@/store/libraryExport';
import type { LibraryState } from '@/store/librarySchema';

/**
 * Il lato sporco dell'export: file e intent Android.
 *
 * Formato, validazione e fusione stanno in `libraryExport`, che e' puro e
 * testato. Qui non si decide niente, si sposta soltanto del testo dentro e
 * fuori dalla sandbox.
 */

/** `onda-libreria-2026-08-30.json`: ordinabile e riconoscibile a colpo d'occhio. */
export function backupFileName(now = new Date()): string {
  const g = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate(),
  ).padStart(2, '0')}`;
  return `onda-libreria-${g}.json`;
}

export type ExportOutcome =
  | { ok: true; shared: true }
  | { ok: true; shared: false; uri: string }
  | { ok: false; reason: string };

/**
 * Scrive l'export nella cache e lo passa al menu di condivisione.
 *
 * E' la strada per mandare la libreria altrove di proposito. Per il backup
 * vero usa `saveLibrary`, che non fa uscire il file dal telefono.
 *
 * Cache e non documenti: il file serve solo a raggiungere Drive o un'altra
 * app, e da li' in poi la copia che conta e' quella dell'utente. Tenerne
 * una nostra farebbe crescere l'app a ogni export senza che nessuno la
 * usi mai.
 *
 * Se la condivisione non e' disponibile il file resta comunque scritto e
 * ne restituiamo il percorso: meglio un percorso da copiare che un export
 * che non avviene.
 */
export async function exportLibrary(state: LibraryState): Promise<ExportOutcome> {
  try {
    const file = new File(Paths.cache, backupFileName());
    if (file.exists) file.delete();
    file.create();
    file.write(JSON.stringify(buildExport(state), null, 2));

    if (!(await Sharing.isAvailableAsync())) {
      return { ok: true, shared: false, uri: file.uri };
    }
    await Sharing.shareAsync(file.uri, {
      mimeType: 'application/json',
      dialogTitle: 'Salva la libreria di Onda',
      UTI: 'public.json',
    });
    return { ok: true, shared: true };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : String(e) };
  }
}

export type SaveOutcome =
  { ok: true; name: string } | { ok: false; canceled: true } | { ok: false; reason: string };

/**
 * Expo ricava il codice dal nome della classe Kotlin: `PickerCancelledException`
 * diventa `ERR_PICKER_CANCELLED`. A differenza del selettore di file, quello di
 * cartelle segnala l'annullamento rigettando, quindi qui l'annullamento va
 * distinto a mano da un guasto vero.
 */
const PICKER_CANCELLED = 'ERR_PICKER_CANCELLED';

function annullato(e: unknown): boolean {
  return (
    typeof e === 'object' &&
    e !== null &&
    'code' in e &&
    (e as { code?: unknown }).code === PICKER_CANCELLED
  );
}

/**
 * Scrive l'export nella cartella scelta dall'utente, senza intermediari.
 *
 * E' la strada giusta per un backup: `exportLibrary` chiede «a chi lo mando»
 * e ogni destinazione e' un'app che porta la libreria fuori dal telefono,
 * mentre qui si chiede «dove lo metto» e il file non lascia il dispositivo.
 * Il selettore e' quello di sistema (Documents UI), presente su ogni Android:
 * non serve un gestore file installato.
 *
 * Il permesso arriva dalla cartella che l'utente indica, quindi restiamo
 * senza permessi di archiviazione nel manifest.
 *
 * Da Android 11 il selettore rifiuta la radice della memoria e `Download`
 * («Impossibile usare questa cartella»): e' una restrizione di sistema, non
 * nostra, e il selettore la spiega da se' offrendo di creare una cartella.
 * `Documents` va bene ed e' la scelta naturale.
 *
 * Restituiamo il nome del file creato e non quello richiesto: se un export
 * di oggi c'e' gia', il Storage Access Framework affianca un `(1)` invece di
 * sovrascrivere, e all'utente va detto il nome vero.
 */
export async function saveLibrary(state: LibraryState): Promise<SaveOutcome> {
  try {
    const dir = await Directory.pickDirectoryAsync();
    const file = dir.createFile(backupFileName(), 'application/json');
    file.write(JSON.stringify(buildExport(state), null, 2));
    return { ok: true, name: file.name };
  } catch (e) {
    if (annullato(e)) return { ok: false, canceled: true };
    return { ok: false, reason: e instanceof Error ? e.message : String(e) };
  }
}

export type PickOutcome = ParseResult | { ok: false; canceled: true; reason: string };

/**
 * Apre il selettore di sistema e legge il file scelto.
 *
 * `application/json` piu' il jolly: alcuni provider (Drive, certe app di
 * messaggistica) consegnano i .json come `application/octet-stream` o
 * senza tipo, e filtrando stretto il file dell'utente non comparirebbe.
 * A dire se il contenuto e' nostro ci pensa `parseExport`.
 *
 * Nota: `pickFileAsync` riporta come annullamento qualsiasi errore del
 * selettore, quindi un guasto vero qui e' indistinguibile da un ripensamento.
 * Non e' grave — in entrambi i casi non c'e' niente da importare — ma spiega
 * perche' non proviamo a raccontare all'utente cosa e' andato storto.
 */
export async function pickBackup(): Promise<PickOutcome> {
  try {
    const picked = await File.pickFileAsync({
      mimeTypes: ['application/json', 'application/octet-stream', '*/*'],
    });
    if (picked.canceled || !picked.result) {
      return { ok: false, canceled: true, reason: 'Nessun file scelto.' };
    }
    return parseExport(await picked.result.text());
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : String(e) };
  }
}

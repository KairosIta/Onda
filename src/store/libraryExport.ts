import { HISTORY_MAX, loadLibrary, type LibraryState, type Playlist } from './librarySchema';
import type { Track } from '@/types/track';

/**
 * Export e import della libreria: l'unica via di recupero che esiste.
 *
 * Non e' una comodita'. La build personale firma con una chiave locale,
 * `allowBackup=false` esclude il backup di sistema e l'APK non e'
 * debuggable, quindi `run-as` e `adb backup` non servono a niente: se la
 * chiave cambia, o si disinstalla, preferiti e playlist se ne vanno e non
 * tornano. Questo file e' il solo modo di portarli fuori.
 *
 * Tutto puro, come `librarySchema`: il formato e la fusione si verificano
 * senza MMKV ne' dispositivo, ed e' la parte in cui un errore costa dati.
 */

/**
 * Versione del formato, non dell'app.
 *
 * Da alzare solo quando un file vecchio non e' piu' leggibile cosi' com'e'.
 * Aggiungere un campo facoltativo non la alza: `loadLibrary` ignora quello
 * che non conosce, quindi una versione futura resta apribile da qui e una
 * vecchia da una versione futura.
 */
export const EXPORT_VERSION = 1;

/** Marcatore del formato: distingue il nostro file da un JSON qualunque. */
export const EXPORT_FORMAT = 'onda.library';

export interface LibraryExport {
  format: typeof EXPORT_FORMAT;
  version: number;
  /** Epoch ms: serve solo a farlo leggere a un umano. */
  exportedAt: number;
  library: LibraryState;
}

export function buildExport(state: LibraryState, now = Date.now()): LibraryExport {
  return {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exportedAt: now,
    library: state,
  };
}

export type ParseResult = { ok: true; library: LibraryState } | { ok: false; reason: string };

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Legge un file di export.
 *
 * Rifiuta prima di tutto cio' che non e' nostro: un JSON altrui che passasse
 * di qui verrebbe "riparato" da `loadLibrary` fino a diventare una libreria
 * vuota, e l'utente vedrebbe un import riuscito che non importa niente.
 * Meglio un errore che dice cosa non torna.
 */
export function parseExport(value: unknown): ParseResult {
  if (typeof value === 'string') {
    try {
      return parseExport(JSON.parse(value));
    } catch {
      return { ok: false, reason: 'Il file non è JSON leggibile.' };
    }
  }
  if (!isRecord(value)) return { ok: false, reason: 'Il file non contiene un oggetto.' };
  if (value.format !== EXPORT_FORMAT) {
    return { ok: false, reason: 'Non è un export di Onda.' };
  }
  if (typeof value.version !== 'number' || !Number.isFinite(value.version)) {
    return { ok: false, reason: 'Manca la versione del formato.' };
  }
  if (value.version > EXPORT_VERSION) {
    return {
      ok: false,
      reason: `File nella versione ${value.version}: serve una versione più recente di Onda.`,
    };
  }
  // Da qui in giu' e' roba nostra e `loadLibrary` sa gia' scartare il
  // singolo pezzo rotto senza buttare via il resto.
  return { ok: true, library: loadLibrary(value.library) };
}

export interface ImportPreview {
  /** Preferiti presenti nel file e non ancora in libreria. */
  newFavorites: number;
  /** Playlist che non esistono ancora, per id. */
  newPlaylists: number;
  /** Playlist gia' presenti a cui il file aggiunge almeno una traccia. */
  grownPlaylists: number;
  /** Tracce che entrano nel catalogo. */
  newTracks: number;
  /** Voci di cronologia nuove. */
  newHistory: number;
  /** Niente da fare: il file non aggiunge nulla. */
  empty: boolean;
}

/** Unione che conserva l'ordine: prima cio' che c'e', poi cio' che arriva. */
const union = (current: string[], incoming: string[]): string[] => [
  ...current,
  ...incoming.filter((uid) => !current.includes(uid)),
];

/**
 * Cosa cambierebbe l'import, senza cambiarlo.
 *
 * I conteggi si ricavano dal merge vero invece di stimarli: stimando si
 * finisce per contare cio' che il merge poi scarta. Succedeva davvero con
 * la cronologia, che ha un tetto — a cronologia piena l'anteprima
 * annunciava voci che non sarebbero entrate, e l'utente confermava un
 * import che non cambiava niente. Cosi' l'anteprima non puo' divergere
 * dal risultato: e' il risultato, misurato.
 */
export function previewImport(current: LibraryState, incoming: LibraryState): ImportPreview {
  const next = mergeLibrary(current, incoming);

  const byId = new Map(current.playlists.map((p) => [p.id, p]));
  let newPlaylists = 0;
  let grownPlaylists = 0;
  for (const p of next.playlists) {
    const mine = byId.get(p.id);
    if (!mine) newPlaylists++;
    else if (p.trackUids.length > mine.trackUids.length) grownPlaylists++;
  }

  // Il merge non toglie mai niente, quindi le differenze sono positive;
  // `max` protegge solo dal caso in cui `current` arrivi non normalizzato.
  const cresciuto = (dopo: number, prima: number): number => Math.max(0, dopo - prima);
  const newFavorites = cresciuto(next.favorites.length, current.favorites.length);
  const newTracks = cresciuto(Object.keys(next.tracks).length, Object.keys(current.tracks).length);
  const newHistory = cresciuto(next.history.length, current.history.length);

  return {
    newFavorites,
    newPlaylists,
    grownPlaylists,
    newTracks,
    newHistory,
    empty: newFavorites + newPlaylists + grownPlaylists + newTracks + newHistory === 0,
  };
}

/**
 * Fonde il file nella libreria attuale. Non toglie mai niente.
 *
 * L'import e' un recupero, non un ripristino: chi importa ha gia' qualcosa
 * di suo, e sostituire sarebbe una seconda perdita di dati subito dopo la
 * prima. Le playlist si uniscono per id — reimportare un export sullo
 * stesso dispositivo non le duplica, e su un'installazione nuova gli id
 * non si scontrano.
 *
 * Sulle tracce vince la copia gia' presente: e' stata vista piu' di
 * recente dalla sorgente, mentre quella del file e' vecchia quanto
 * l'export. Vale per i metadati; l'insieme delle tracce e' comunque
 * l'unione.
 */
export function mergeLibrary(current: LibraryState, incoming: LibraryState): LibraryState {
  const tracks: Record<string, Track> = { ...incoming.tracks, ...current.tracks };

  const byId = new Map(current.playlists.map((p) => [p.id, p]));
  const merged: Playlist[] = current.playlists.map((mine) => {
    const theirs = incoming.playlists.find((p) => p.id === mine.id);
    return theirs ? { ...mine, trackUids: union(mine.trackUids, theirs.trackUids) } : mine;
  });
  for (const p of incoming.playlists) {
    if (!byId.has(p.id)) merged.push(p);
  }

  const next: LibraryState = {
    tracks,
    favorites: union(current.favorites, incoming.favorites),
    playlists: merged,
    history: union(current.history, incoming.history).slice(0, HISTORY_MAX),
  };

  // Ultima parola allo schema: scarta i riferimenti che non risolvono e
  // rinormalizza, cosi' l'esito di un import e' indistinguibile da uno
  // stato costruito dall'app.
  return loadLibrary(next);
}

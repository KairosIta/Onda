import type { Track } from '@/types/track';
import { parseTrack } from './librarySchema';

/**
 * Forma su disco della sessione di ascolto: la coda e la posizione nel
 * brano attivo. Separate in due chiavi perche' cambiano a ritmi diversi:
 * la coda a ogni transizione, la posizione ogni pochi secondi. Salvare la
 * coda intera ogni cinque secondi sarebbe uno spreco di scritture.
 *
 * Modulo puro come `librarySchema`: qui non si tocca il player, quindi la
 * regola che decide cosa si riprende e da dove si verifica senza device.
 */

/**
 * Tetto alla coda salvata. Le raccolte Jamendo arrivano a cento brani e
 * il trending a qualche decina: duecento coprono l'uso reale, e oltre si
 * conserva una finestra intorno al brano attivo invece dell'elenco intero.
 */
export const SESSION_MAX_TRACKS = 200;

/** Oltre un mese la coda e' un ricordo, non una sessione da riprendere. */
export const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * A meno di cinque secondi dalla fine si riparte da capo: riprendere sui
 * titoli di coda di un brano significherebbe sentirne mezzo secondo e
 * passare al successivo, che non e' quello che chi riapre l'app si aspetta.
 */
export const RESUME_TAIL_SEC = 5;

export interface SavedQueue {
  tracks: Track[];
  /** Indice del brano attivo dentro `tracks`. */
  index: number;
  savedAt: number;
}

export interface SavedPosition {
  uid: string;
  /** Secondi dall'inizio del brano `uid`. */
  position: number;
  savedAt: number;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Riduce una coda lunga a una finestra di `max` brani che contiene quello
 * attivo, tenendo piu' futuro che passato: un quarto della finestra sta
 * prima del brano attivo, il resto dopo. L'indice ritornato e' relativo
 * alla finestra.
 */
export function windowQueue(
  tracks: Track[],
  index: number,
  max = SESSION_MAX_TRACKS,
): { tracks: Track[]; index: number } {
  if (tracks.length <= max) return { tracks, index };
  const before = Math.floor(max / 4);
  const start = Math.min(Math.max(0, index - before), tracks.length - max);
  return { tracks: tracks.slice(start, start + max), index: index - start };
}

/**
 * Valida la coda salvata. Un brano malformato viene scartato senza buttare
 * gli altri, ma se il brano attivo non e' valido non c'e' niente da
 * riprendere: una coda senza un punto di partenza e' un elenco, non una
 * sessione.
 */
export function loadSavedQueue(value: unknown, now: number): SavedQueue | null {
  if (!isRecord(value) || !Array.isArray(value.tracks)) return null;
  if (typeof value.savedAt !== 'number' || !Number.isFinite(value.savedAt)) return null;
  if (now - value.savedAt > SESSION_MAX_AGE_MS) return null;

  const rawIndex = Number.isInteger(value.index) ? (value.index as number) : -1;
  const tracks: Track[] = [];
  let index = -1;
  value.tracks.forEach((raw, i) => {
    const track = parseTrack(raw);
    if (!track) return;
    if (i === rawIndex) index = tracks.length;
    tracks.push(track);
  });
  if (index < 0) return null;

  return { tracks, index, savedAt: value.savedAt };
}

export function loadSavedPosition(value: unknown): SavedPosition | null {
  if (!isRecord(value)) return null;
  if (typeof value.uid !== 'string' || !value.uid) return null;
  if (typeof value.position !== 'number' || !Number.isFinite(value.position)) return null;
  if (value.position < 0) return null;
  return {
    uid: value.uid,
    position: value.position,
    savedAt: typeof value.savedAt === 'number' ? value.savedAt : 0,
  };
}

/**
 * Da dove ripartire. La posizione vale solo se appartiene al brano attivo
 * della coda salvata: le due chiavi si scrivono in momenti diversi, e una
 * posizione rimasta indietro di un brano riprenderebbe quello nuovo a
 * meta' senza motivo.
 */
export function resumePosition(queue: SavedQueue, saved: SavedPosition | null): number {
  const active = queue.tracks[queue.index];
  if (!active || !saved || saved.uid !== active.uid) return 0;
  if (active.durationSec > 0 && saved.position >= active.durationSec - RESUME_TAIL_SEC) return 0;
  return saved.position;
}

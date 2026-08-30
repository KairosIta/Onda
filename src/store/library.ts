import { useSyncExternalStore } from 'react';
import { readJSON, writeJSON } from '@/services/storage';
import { mergeLibrary, previewImport, type ImportPreview } from './libraryExport';
import { HISTORY_MAX, loadLibrary, type LibraryState } from './librarySchema';
import type { Track } from '@/types/track';

/**
 * Libreria locale: preferiti, playlist, cronologia.
 *
 * Le tracce sono normalizzate in un catalogo `tracks` e ovunque si
 * maneggiano solo uid. Senza questo, la stessa traccia in tre playlist
 * sarebbe tre copie che divergono appena una sorgente cambia un titolo.
 *
 * Store minimale su useSyncExternalStore invece di Zustand o Redux:
 * uno stato solo, sincrono, persistito su MMKV a ogni mutazione.
 */

const KEY = 'library.v1';

let state: LibraryState = loadLibrary(readJSON(KEY));

/**
 * Catalogo volatile: tutto quello che passa a schermo finisce qui, ma
 * non su disco. Serve a risolvere un uid in Track nel momento in cui
 * viene salvato davvero (preferito, playlist, cronologia).
 *
 * Con lo scroll infinito su due cataloghi federati questa mappa cresce
 * per tutta la vita del processo, quindi ha un tetto. Sfrattare non
 * perde niente di importante: qualunque traccia l'utente abbia davvero
 * salvato sta anche in `state.tracks`, e `resolve` ci ricade sopra. Al
 * massimo si perde la freschezza di un campo, non la traccia. La traccia
 * in riproduzione e' sempre al sicuro: `recordPlay` la persiste appena
 * parte.
 */
const SESSION_MAX = 500;
const session = new Map<string, Track>();

/** Inserisce nel catalogo volatile rispettando il tetto. */
function keep(track: Track): void {
  // Reinserire sposta la traccia in fondo: Map itera in ordine di
  // inserimento, quindi le riviste di recente sopravvivono a una
  // sessione di scroll lunga e il primo elemento e' sempre il piu' vecchio.
  session.delete(track.uid);
  session.set(track.uid, track);
  if (session.size > SESSION_MAX) {
    const oldest = session.keys().next();
    if (!oldest.done) session.delete(oldest.value);
  }
}

const listeners = new Set<() => void>();

/** Butta via le tracce persistite che non serve piu' tenere. */
function prune(next: LibraryState): LibraryState {
  const referenced = new Set<string>([
    ...next.favorites,
    ...next.history,
    ...next.playlists.flatMap((p) => p.trackUids),
  ]);
  const tracks: Record<string, Track> = {};
  for (const uid of referenced) {
    // I dati appena letti dalla sorgente possono aggiungere backlink o altri
    // campi a una traccia salvata con una versione precedente dell'app.
    const t = session.get(uid) ?? next.tracks[uid];
    if (t) tracks[uid] = t;
  }
  return { ...next, tracks };
}

function commit(next: LibraryState): void {
  state = prune(next);
  writeJSON(KEY, state);
  listeners.forEach((l) => l());
}

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** Ritorna l'intero stato: il riferimento cambia solo dopo una mutazione. */
export function useLibrary(): LibraryState {
  return useSyncExternalStore(subscribe, () => state);
}

export const getLibrary = (): LibraryState => state;

// --- catalogo -------------------------------------------------------

/** Registra tracce viste a schermo, senza persisterle. */
export function remember(tracks: Track[]): void {
  for (const t of tracks) keep(t);
}

export function resolve(uid: string): Track | undefined {
  // La copia di sessione e' la piu' fresca; quella persistita resta il
  // fallback per avvio offline e raccolte non ancora visitate.
  return session.get(uid) ?? state.tracks[uid];
}

/** Risolve una lista di uid scartando quelli non risolvibili. */
export function tracksOf(uids: string[]): Track[] {
  return uids.map(resolve).filter((t): t is Track => Boolean(t));
}

// --- preferiti ------------------------------------------------------

export const isFavorite = (uid: string): boolean => state.favorites.includes(uid);

export function toggleFavorite(track: Track): void {
  keep(track);
  const on = state.favorites.includes(track.uid);
  commit({
    ...state,
    tracks: on ? state.tracks : { ...state.tracks, [track.uid]: track },
    favorites: on
      ? state.favorites.filter((u) => u !== track.uid)
      : [track.uid, ...state.favorites],
  });
}

// --- playlist -------------------------------------------------------

const newId = (): string => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export function createPlaylist(name: string, seed: Track[] = []): string {
  const id = newId();
  seed.forEach(keep);
  commit({
    ...state,
    tracks: { ...state.tracks, ...Object.fromEntries(seed.map((t) => [t.uid, t])) },
    playlists: [
      {
        id,
        name: name.trim() || 'Senza titolo',
        createdAt: Date.now(),
        trackUids: seed.map((t) => t.uid),
      },
      ...state.playlists,
    ],
  });
  return id;
}

export function renamePlaylist(id: string, name: string): void {
  commit({
    ...state,
    playlists: state.playlists.map((p) =>
      p.id === id ? { ...p, name: name.trim() || p.name } : p,
    ),
  });
}

export function deletePlaylist(id: string): void {
  commit({ ...state, playlists: state.playlists.filter((p) => p.id !== id) });
}

/** Aggiunge in coda alla playlist. Ignora i duplicati. */
export function addToPlaylist(playlistId: string, track: Track): boolean {
  const playlist = state.playlists.find((p) => p.id === playlistId);
  if (!playlist || playlist.trackUids.includes(track.uid)) return false;

  keep(track);
  commit({
    ...state,
    tracks: { ...state.tracks, [track.uid]: track },
    playlists: state.playlists.map((p) =>
      p.id === playlistId ? { ...p, trackUids: [...p.trackUids, track.uid] } : p,
    ),
  });
  return true;
}

export function removeFromPlaylist(playlistId: string, uid: string): void {
  commit({
    ...state,
    playlists: state.playlists.map((p) =>
      p.id === playlistId ? { ...p, trackUids: p.trackUids.filter((u) => u !== uid) } : p,
    ),
  });
}

export function movePlaylistTrack(playlistId: string, from: number, to: number): void {
  commit({
    ...state,
    playlists: state.playlists.map((p) => {
      if (p.id !== playlistId) return p;
      const uids = [...p.trackUids];
      if (from < 0 || to < 0 || from >= uids.length || to >= uids.length) return p;
      const [moved] = uids.splice(from, 1);
      uids.splice(to, 0, moved);
      return { ...p, trackUids: uids };
    }),
  });
}

// --- cronologia -----------------------------------------------------

export function recordPlay(uid: string): void {
  const track = resolve(uid);
  if (!track) return; // traccia mai vista: niente da salvare
  if (state.history[0] === uid) return; // gia' in testa, evita i doppioni da re-render

  commit({
    ...state,
    tracks: { ...state.tracks, [uid]: track },
    history: [uid, ...state.history.filter((u) => u !== uid)].slice(0, HISTORY_MAX),
  });
}

export function clearHistory(): void {
  commit({ ...state, history: [] });
}

// --- import ---------------------------------------------------------

/**
 * Fonde un export nella libreria. Ritorna cosa e' entrato davvero.
 *
 * Le tracce importate non passano da `keep`: sono gia' in `next.tracks`,
 * che e' cio' su cui ricadono sia `prune` sia `resolve`, quindi sono
 * riproducibili subito. Passarcele avrebbe solo sfrattato dal catalogo di
 * sessione quello che l'utente stava sfogliando, visto che il tetto e'
 * molto piu' basso di una libreria importata.
 */
export function importLibrary(incoming: LibraryState): ImportPreview {
  const applied = previewImport(state, incoming);
  if (applied.empty) return applied;

  commit(mergeLibrary(state, incoming));
  return applied;
}

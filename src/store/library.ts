import { useSyncExternalStore } from 'react';
import { readJSON, writeJSON } from '@/services/storage';
import { loadLibrary, type LibraryState } from './librarySchema';
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
const HISTORY_MAX = 100;

let state: LibraryState = loadLibrary(readJSON(KEY));

/**
 * Catalogo volatile: tutto quello che passa a schermo finisce qui, ma
 * non su disco. Serve a risolvere un uid in Track nel momento in cui
 * viene salvato davvero (preferito, playlist, cronologia).
 */
const session = new Map<string, Track>();

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
  for (const t of tracks) session.set(t.uid, t);
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
  session.set(track.uid, track);
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
  seed.forEach((t) => session.set(t.uid, t));
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

  session.set(track.uid, track);
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

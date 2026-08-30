import type { Track } from '@/types/track';

export interface Playlist {
  id: string;
  name: string;
  createdAt: number;
  trackUids: string[];
}

export interface LibraryState {
  tracks: Record<string, Track>;
  favorites: string[];
  playlists: Playlist[];
  history: string[];
}

/** Tetto della cronologia, condiviso da store e import. */
export const HISTORY_MAX = 100;

const empty = (): LibraryState => ({ tracks: {}, favorites: [], playlists: [], history: [] });

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const optionalString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.length > 0 ? value : undefined;

export function parseTrack(value: unknown): Track | undefined {
  if (!isRecord(value)) return undefined;
  if (value.source !== 'audius' && value.source !== 'jamendo') return undefined;
  if (typeof value.id !== 'string' || typeof value.uid !== 'string') return undefined;
  if (value.uid !== `${value.source}:${value.id}`) return undefined;
  if (typeof value.title !== 'string' || typeof value.artist !== 'string') return undefined;
  if (typeof value.streamUrl !== 'string' || !value.streamUrl) return undefined;
  if (typeof value.durationSec !== 'number' || !Number.isFinite(value.durationSec))
    return undefined;

  return {
    uid: value.uid,
    source: value.source,
    id: value.id,
    title: value.title,
    artist: value.artist,
    durationSec: Math.max(0, value.durationSec),
    streamUrl: value.streamUrl,
    sourceUrl: optionalString(value.sourceUrl),
    rightsLabel: optionalString(value.rightsLabel),
    artworkUrl: optionalString(value.artworkUrl),
    artworkLargeUrl: optionalString(value.artworkLargeUrl),
    licenseUrl: optionalString(value.licenseUrl),
    artistId: optionalString(value.artistId),
    albumId: optionalString(value.albumId),
    albumName: optionalString(value.albumName),
  };
}

const stringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? [...new Set(value.filter((item): item is string => typeof item === 'string'))]
    : [];

export function loadLibrary(value: unknown): LibraryState {
  if (!isRecord(value)) return empty();

  const tracks: Record<string, Track> = {};
  if (isRecord(value.tracks)) {
    for (const candidate of Object.values(value.tracks)) {
      const track = parseTrack(candidate);
      if (track) tracks[track.uid] = track;
    }
  }

  const existing = (uids: string[]): string[] => uids.filter((uid) => Boolean(tracks[uid]));
  const playlistIds = new Set<string>();
  const playlists: Playlist[] = Array.isArray(value.playlists)
    ? value.playlists.flatMap((candidate) => {
        if (!isRecord(candidate)) return [];
        if (typeof candidate.id !== 'string' || typeof candidate.name !== 'string') return [];
        if (!candidate.id || playlistIds.has(candidate.id)) return [];
        if (typeof candidate.createdAt !== 'number' || !Number.isFinite(candidate.createdAt))
          return [];
        playlistIds.add(candidate.id);
        return [
          {
            id: candidate.id,
            name: candidate.name.trim() || 'Senza titolo',
            createdAt: candidate.createdAt,
            trackUids: existing(stringArray(candidate.trackUids)),
          },
        ];
      })
    : [];

  return {
    tracks,
    favorites: existing(stringArray(value.favorites)),
    playlists,
    history: existing(stringArray(value.history)).slice(0, HISTORY_MAX),
  };
}

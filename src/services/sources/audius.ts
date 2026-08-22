import { AUDIUS_APP_NAME } from '@/config/env';
import {
  type ArtistInfo,
  type ListParams,
  makeUid,
  type MusicSource,
  type SearchParams,
  type Track,
  type TrendingParams,
} from '@/types/track';

const BASE = 'https://api.audius.co/v1';

/** Forma parziale della risposta Audius: solo i campi che usiamo davvero. */
interface AudiusTrack {
  id: string;
  title: string;
  duration: number;
  is_streamable?: boolean;
  is_stream_gated?: boolean;
  permalink?: string;
  license?: string | null;
  artwork?: Record<string, string> | null;
  user: { id?: string; name: string; handle: string };
}

interface AudiusUser {
  id: string;
  name?: string;
  handle?: string;
  bio?: string;
  follower_count?: number;
  track_count?: number;
  profile_picture?: Record<string, string> | null;
}

function withAppName(path: string, params: Record<string, string> = {}): string {
  const qs = new URLSearchParams({ app_name: AUDIUS_APP_NAME, ...params });
  return `${BASE}${path}?${qs.toString()}`;
}

/** limit/offset in stringa, saltando i valori non impostati. */
function page({ limit = 20, offset = 0 }: ListParams = {}): Record<string, string> {
  return offset > 0 ? { limit: String(limit), offset: String(offset) } : { limit: String(limit) };
}

export function audiusTrackUrl(permalink: string | undefined): string | undefined {
  if (!permalink) return undefined;
  if (/^https?:\/\//u.test(permalink)) return permalink;
  return `https://audius.co/${permalink.replace(/^\/+/, '')}`;
}

export function audiusRightsLabel(license: string | null | undefined): string {
  const value = license?.trim();
  if (!value || value.toLowerCase() === 'all rights reserved') {
    return 'Tutti i diritti riservati';
  }
  const cc = value.match(/\bCC\s+([A-Z-]+)/iu);
  return cc ? `CC ${cc[1].toUpperCase()}` : value;
}

function mapTrack(t: AudiusTrack): Track {
  return {
    uid: makeUid('audius', t.id),
    source: 'audius',
    id: t.id,
    title: t.title,
    artist: t.user?.name || t.user?.handle || 'Sconosciuto',
    artworkUrl: t.artwork?.['480x480'] ?? t.artwork?.['150x150'],
    // Audius espone anche 1000x1000: e' quella che serve al player, dove
    // l'immagine occupa tutta la larghezza dello schermo.
    artworkLargeUrl: t.artwork?.['1000x1000'] ?? t.artwork?.['480x480'],
    durationSec: t.duration,
    // Risponde con un redirect verso il content node. ExoPlayer lo segue
    // da solo e l'endpoint supporta l'header Range, quindi il seek funziona.
    streamUrl: withAppName(`/tracks/${t.id}/stream`),
    sourceUrl: audiusTrackUrl(t.permalink),
    rightsLabel: audiusRightsLabel(t.license),
    artistId: t.user?.id,
    // Audius espone album_backlink, ma nella pratica e' quasi sempre null:
    // meglio non offrire una pagina album che porta a un vicolo cieco.
  };
}

/**
 * Le tracce "stream gated" richiedono un acquisto o un tip: se finiscono
 * in coda il player si blocca su un errore di rete. Le filtriamo qui,
 * una volta sola, invece di gestire il caso in ogni schermata.
 */
const playable = (t: AudiusTrack): boolean => !t.is_stream_gated && t.is_streamable !== false;

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Audius ha risposto ${res.status}`);
  return (await res.json()) as T;
}

async function fetchTracks(url: string): Promise<Track[]> {
  const json = await fetchJSON<{ data?: AudiusTrack[] }>(url);
  return (json.data ?? []).filter(playable).map(mapTrack);
}

export const audiusSource: MusicSource = {
  id: 'audius',
  label: 'Audius',

  async search({ query, ...rest }: SearchParams): Promise<Track[]> {
    return fetchTracks(withAppName('/tracks/search', { query, ...page(rest) }));
  },

  async trending({ genre, ...rest }: TrendingParams = {}): Promise<Track[]> {
    return fetchTracks(
      withAppName('/tracks/trending', { ...page(rest), ...(genre ? { genre } : {}) }),
    );
  },

  async artistTracks(artistId: string, params: ListParams = {}): Promise<Track[]> {
    return fetchTracks(withAppName(`/users/${artistId}/tracks`, page(params)));
  },

  async artistInfo(artistId: string): Promise<ArtistInfo> {
    const json = await fetchJSON<{ data?: AudiusUser }>(withAppName(`/users/${artistId}`));
    const u = json.data;
    if (!u) throw new Error('Artista non trovato su Audius');

    const bits = [
      u.follower_count != null ? `${u.follower_count.toLocaleString('it-IT')} follower` : null,
      u.track_count != null ? `${u.track_count} brani` : null,
    ].filter(Boolean);

    return {
      id: artistId,
      source: 'audius',
      name: u.name || u.handle || 'Sconosciuto',
      imageUrl: u.profile_picture?.['480x480'] ?? u.profile_picture?.['150x150'],
      bio: u.bio ?? undefined,
      detail: bits.join(' · ') || undefined,
    };
  },
};

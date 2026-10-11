import type { MediaItem } from '@/player';
import { parseUid, type Track } from '@/types/track';

/** Converte il nostro modello in quello che si aspetta il player. */
export const toMediaItem = (t: Track): MediaItem => ({
  mediaId: t.uid,
  url: t.streamUrl,
  title: t.title,
  artist: t.artist,
  // La misura grande: questa immagine finisce sul lockscreen e nella
  // notifica espansa, dove viene disegnata molto piu' grande di una riga.
  artworkUrl: t.artworkLargeUrl ?? t.artworkUrl,
  duration: t.durationSec,
  extras: { track: t },
});

/**
 * La strada inversa. Il player conserva solo i campi che gli abbiamo dato:
 * la copia intera del nostro modello viaggia in `extras`, e se manca (un
 * elemento non nostro) si ricostruisce il minimo indispensabile dall'uid.
 *
 * Un uid di una sorgente che non conosciamo non diventa un brano: prima
 * finiva attribuito ad Audius, con una pagina artista e un'attribuzione
 * sbagliate.
 */
export function trackFromMediaItem(item: MediaItem): Track | null {
  const uid = item.mediaId;
  if (!uid) return null;
  const embedded = item.extras?.track as Track | undefined;
  if (embedded?.uid === uid) return embedded;

  const parsed = parseUid(uid);
  if (!parsed) return null;
  return {
    uid,
    source: parsed.source,
    id: parsed.id,
    title: item.title ?? '',
    artist: item.artist ?? '',
    artworkUrl: item.artworkUrl,
    durationSec: item.duration ?? 0,
    streamUrl: item.url,
  };
}

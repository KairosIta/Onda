import { useCallback } from 'react';
import TrackPlayer, { type MediaItem } from '@rntp/player';
import { remember } from '@/store/library';
import { resetPlaybackErrorBudget } from '@/services/playbackService';
import type { Track } from '@/types/track';

/** Converte il nostro modello in quello che si aspetta RNTP. */
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

export function useQueue() {
  /** Sostituisce la coda con `tracks` e parte dall'indice scelto. */
  const playList = useCallback(async (tracks: Track[], startIndex = 0) => {
    if (tracks.length === 0) return;
    // Serve alla cronologia: quando la traccia parte, il player conosce
    // solo l'uid, e senza questo non saprebbe cosa salvare.
    remember(tracks);
    resetPlaybackErrorBudget();

    // Shuffle e' gestito nativamente: preserva l'elemento scelto e permette
    // di attivarlo/disattivarlo anche dopo che la coda e' stata caricata.
    TrackPlayer.setMediaItems(tracks.map(toMediaItem), startIndex);
    TrackPlayer.play();
  }, []);

  /** Inserisce subito dopo la traccia corrente. */
  const playNext = useCallback(async (track: Track) => {
    remember([track]);
    const current = TrackPlayer.getActiveMediaItemIndex();
    TrackPlayer.insertMediaItem((current ?? -1) + 1, toMediaItem(track));
  }, []);

  /** Accoda in fondo. */
  const addLast = useCallback(async (track: Track) => {
    remember([track]);
    TrackPlayer.addMediaItem(toMediaItem(track));
  }, []);

  return { playList, playNext, addLast };
}

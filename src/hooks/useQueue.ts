import { useCallback } from 'react';
import TrackPlayer from '@rntp/player';
import { toMediaItem } from '@/services/mediaItems';
import { resetPlaybackErrorBudget } from '@/services/playbackService';
import { remember } from '@/store/library';
import { requestNotificationPermission } from '@/store/notificationPermission';
import { activateSession, clearPending } from '@/store/session';
import type { Track } from '@/types/track';

export function useQueue() {
  /** Sostituisce la coda con `tracks` e parte dall'indice scelto. */
  const playList = useCallback(async (tracks: Track[], startIndex = 0) => {
    if (tracks.length === 0) return;
    // Serve alla cronologia: quando la traccia parte, il player conosce
    // solo l'uid, e senza questo non saprebbe cosa salvare.
    remember(tracks);
    // Primo play: da qui in poi la notifica serve davvero.
    requestNotificationPermission();
    resetPlaybackErrorBudget();
    // Una coda nuova manda in pensione quella ripristinata dal disco.
    clearPending();

    // Shuffle e' gestito nativamente: preserva l'elemento scelto e permette
    // di attivarlo/disattivarlo anche dopo che la coda e' stata caricata.
    TrackPlayer.setMediaItems(tracks.map(toMediaItem), startIndex);
    TrackPlayer.play();
  }, []);

  /** Inserisce subito dopo la traccia corrente. */
  const playNext = useCallback(async (track: Track) => {
    remember([track]);
    // La coda ripristinata va prima messa nel player, altrimenti "dopo il
    // brano corrente" sarebbe dentro una coda vuota.
    activateSession({ play: false });
    const current = TrackPlayer.getActiveMediaItemIndex();
    TrackPlayer.insertMediaItem((current ?? -1) + 1, toMediaItem(track));
  }, []);

  /** Accoda in fondo. */
  const addLast = useCallback(async (track: Track) => {
    remember([track]);
    activateSession({ play: false });
    TrackPlayer.addMediaItem(toMediaItem(track));
  }, []);

  return { playList, playNext, addLast };
}

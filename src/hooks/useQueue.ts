import { useCallback } from 'react';
import TrackPlayer from '@rntp/player';
import { toMediaItem } from '@/services/mediaItems';
import { playableQueue } from '@/services/playableTracks';
import { resetPlaybackErrorBudget } from '@/services/playbackService';
import { isSourceAvailable } from '@/services/sources/access';
import { remember } from '@/store/library';
import { requestNotificationPermission } from '@/store/notificationPermission';
import { activateSession, clearPending } from '@/store/session';
import type { Track } from '@/types/track';

export function useQueue() {
  /**
   * Sostituisce la coda con `tracks` e parte dall'indice scelto. I brani di
   * una sorgente spenta restano fuori (vedi `playableQueue`); `false` se non
   * ne resta nessuno da suonare.
   */
  const playList = useCallback(async (all: Track[], startIndex = 0) => {
    const queue = playableQueue(all, startIndex, isSourceAvailable);
    if (!queue) return false;
    const { tracks, index } = queue;
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
    TrackPlayer.setMediaItems(tracks.map(toMediaItem), index);
    TrackPlayer.play();
    return true;
  }, []);

  /** Inserisce subito dopo la traccia corrente; `false` se la sorgente e' spenta. */
  const playNext = useCallback(async (track: Track) => {
    if (!isSourceAvailable(track.source)) return false;
    remember([track]);
    // La coda ripristinata va prima messa nel player, altrimenti "dopo il
    // brano corrente" sarebbe dentro una coda vuota.
    activateSession({ play: false });
    const current = TrackPlayer.getActiveMediaItemIndex();
    TrackPlayer.insertMediaItem((current ?? -1) + 1, toMediaItem(track));
    return true;
  }, []);

  /** Accoda in fondo; `false` se la sorgente e' spenta. */
  const addLast = useCallback(async (track: Track) => {
    if (!isSourceAvailable(track.source)) return false;
    remember([track]);
    activateSession({ play: false });
    TrackPlayer.addMediaItem(toMediaItem(track));
    return true;
  }, []);

  return { playList, playNext, addLast };
}

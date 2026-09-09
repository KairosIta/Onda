import TrackPlayer from '@rntp/player';
import { activateSession } from '@/store/session';
import type { PlaybackStatus } from './playbackStatus';

/**
 * I comandi di trasporto dell'app passano da qui, non da TrackPlayer
 * direttamente: sono loro a sapere che una coda ripristinata va prima
 * caricata nel player, e cosa vuol dire "play" in ogni stato.
 */

export function togglePlayback(status: PlaybackStatus): void {
  // La coda in attesa: caricarla e' gia' il play.
  if (activateSession({ play: true })) return;

  switch (status) {
    case 'playing':
    case 'buffering':
      // Chi tocca uno spinner vuole fermare il caricamento.
      TrackPlayer.pause();
      return;
    case 'error':
      retryPlayback();
      return;
    case 'ended':
      // A coda finita ExoPlayer ignora play(): si riparte dal brano corrente.
      TrackPlayer.seekTo(0);
      TrackPlayer.play();
      return;
    default:
      TrackPlayer.play();
  }
}

export function skipToNext(): void {
  activateSession({ play: true });
  TrackPlayer.skipToNext();
}

export function skipToPrevious(): void {
  activateSession({ play: true });
  TrackPlayer.skipToPrevious();
}

/** `retry` riprepara la sorgente ma non riparte da solo. */
export function retryPlayback(): void {
  TrackPlayer.retry();
  TrackPlayer.play();
}

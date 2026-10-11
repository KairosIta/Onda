import { player } from '@/player';
import { requestNotificationPermission } from '@/store/notificationPermission';
import { activateSession } from '@/store/session';
import type { PlaybackStatus } from './playbackStatus';

/**
 * I comandi di trasporto dell'app passano da qui, non dal player
 * direttamente: sono loro a sapere che una coda ripristinata va prima
 * caricata nel player, e cosa vuol dire "play" in ogni stato.
 */

export function togglePlayback(status: PlaybackStatus): void {
  if (status === 'playing' || status === 'buffering') {
    // Chi tocca uno spinner vuole fermare il caricamento.
    player.pause();
    return;
  }

  // È un play: il momento giusto per chiedere il permesso notifiche, che
  // senza una riproduzione in corso non avrebbe senso per nessuno.
  requestNotificationPermission();

  // La coda in attesa: caricarla e' gia' il play.
  if (activateSession({ play: true })) return;

  switch (status) {
    case 'error':
      retryPlayback();
      return;
    case 'ended':
      // A coda finita ExoPlayer ignora play(): si riparte dal brano corrente.
      player.seekTo(0);
      player.play();
      return;
    default:
      player.play();
  }
}

export function skipToNext(): void {
  activateSession({ play: true });
  player.skipToNext();
}

export function skipToPrevious(): void {
  activateSession({ play: true });
  player.skipToPrevious();
}

/** `retry` riprepara la sorgente ma non riparte da solo. */
export function retryPlayback(): void {
  player.retry();
  player.play();
}

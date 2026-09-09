import TrackPlayer, { PlayerCommand } from '@rntp/player';
import { applyRepeat } from '@/store/playback';
import { startProgressObserver } from '@/store/progress';
import { restoreSession, startSessionPersistence } from '@/store/session';
import { startForegroundPlaybackListeners } from './playbackService';

let ready: Promise<void> | null = null;

/** Configura una sola volta il player nativo per questo processo UI. */
export function setupPlayer(): Promise<void> {
  if (ready) return ready;

  ready = Promise.resolve()
    .then(() => {
      TrackPlayer.setupPlayer({
        contentType: 'music',
        handleAudioBecomingNoisy: true,
        audioMixing: 'exclusive',
        // Timer nativo che emette la posizione ogni cinque secondi in
        // riproduzione e un ultimo colpo alla pausa, a schermo spento
        // compreso: e' cosi' che la sessione (store/session) sa da dove
        // riprendere. Senza `http` non manda niente fuori dal telefono.
        progressSync: { intervalSeconds: 5 },
        android: {
          wakeMode: 'network',
          taskRemovedBehavior: 'stop',
        },
      });

      // Il comportamento nativo continua a funzionare con JS sospeso e in
      // Android Auto; non servono listener JS per i normali tasti media.
      TrackPlayer.setCommands({
        capabilities: [
          PlayerCommand.PlayPause,
          PlayerCommand.Next,
          PlayerCommand.Previous,
          PlayerCommand.Seek,
          PlayerCommand.Stop,
        ],
        handling: 'native',
      });

      applyRepeat();
      startForegroundPlaybackListeners();
      startProgressObserver();
      startSessionPersistence();
      // Per ultima: legge il player, e i listener sopra devono gia' esserci.
      restoreSession();
    })
    .catch((error) => {
      ready = null;
      throw error;
    });

  return ready;
}

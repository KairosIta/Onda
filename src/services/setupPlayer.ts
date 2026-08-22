import TrackPlayer, { PlayerCommand } from '@rntp/player';
import { applyRepeat } from '@/store/playback';
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
    })
    .catch((error) => {
      ready = null;
      throw error;
    });

  return ready;
}

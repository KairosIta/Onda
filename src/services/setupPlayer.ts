import { player } from '@/player';
import { applyRepeat } from '@/store/playback';
import { startBrowseTreeSync } from './browseTreeSync';
import { startSourceGuard } from './sourceGuard';
import { startProgressObserver } from '@/store/progress';
import { restoreSession, startSessionPersistence } from '@/store/session';
import { startForegroundPlaybackListeners } from './playbackService';

let ready: Promise<void> | null = null;

/** Configura una sola volta il player nativo per questo processo UI. */
export function setupPlayer(): Promise<void> {
  if (ready) return ready;

  ready = Promise.resolve()
    .then(() => {
      player.setup({
        // Timer nativo che emette la posizione ogni cinque secondi in
        // riproduzione e un ultimo colpo alla pausa, a schermo spento
        // compreso: e' cosi' che la sessione (store/session) sa da dove
        // riprendere.
        progressIntervalSeconds: 5,
        // Il comportamento nativo continua a funzionare con JS sospeso e in
        // Android Auto; non servono listener JS per i normali tasti media.
        commands: ['play-pause', 'next', 'previous', 'seek', 'stop'],
      });

      applyRepeat();
      startForegroundPlaybackListeners();
      startProgressObserver();
      startSessionPersistence();
      // Per ultima: legge il player, e i listener sopra devono gia' esserci.
      restoreSession();
      // Una sorgente spenta esce anche dalla riproduzione.
      startSourceGuard();
      // L'albero per Android Auto: dopo, perche' non serve a nessuna schermata.
      startBrowseTreeSync();
    })
    .catch((error) => {
      ready = null;
      throw error;
    });

  return ready;
}

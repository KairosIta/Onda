import TrackPlayer, {
  Event,
  type BackgroundEvent,
  type IsPlayingChangedEvent,
  type MediaItem,
  type PlaybackErrorEvent,
  type PlaybackProgressUpdatedEvent,
  type PlaybackStateChangedEvent,
} from '@rntp/player';
import { recordPlay, remember } from '@/store/library';
import { clearPlaybackFault, markPlaybackFault } from '@/store/playbackFault';
import { savePosition, saveQueueSnapshot } from '@/store/session';
import type { Track } from '@/types/track';
import { reachedListen } from './historyPolicy';
import { budgetAfterPlayingChange, decideSkip, networkRetryDelay } from './playbackPolicy';

/** Salti consumati dall'ultima riproduzione riuscita. La regola sta in playbackPolicy. */
let sourceSkips = 0;
let foregroundListenersStarted = false;
/** Il brano già messo in cronologia in questa visita: si registra una volta sola. */
let listenedId: string | null = null;
/** Tentativi automatici dopo un errore di rete, e il timer del prossimo. */
let networkRetries = 0;
let networkRetryTimer: ReturnType<typeof setTimeout> | null = null;

function cancelNetworkRetry(): void {
  if (networkRetryTimer) clearTimeout(networkRetryTimer);
  networkRetryTimer = null;
}

/** Riprepara la sorgente e riparte: la stessa mossa del tasto Riprova. */
function scheduleNetworkRetry(): void {
  const delay = networkRetryDelay(networkRetries);
  if (delay === null) return;
  networkRetries++;
  cancelNetworkRetry();
  networkRetryTimer = setTimeout(() => {
    networkRetryTimer = null;
    TrackPlayer.retry();
    TrackPlayer.play();
  }, delay);
}

/**
 * Il catalogo volatile deve conoscere il brano subito, non alla soglia:
 * la cronologia lo risolve per uid, e la Coda o Android Auto possono
 * averlo messo in riproduzione senza che una lista lo abbia mai mostrato.
 */
function rememberItem(item: MediaItem | null): void {
  const track = item?.extras?.track as Track | undefined;
  if (track && track.uid === item?.mediaId) remember([track]);
}

/** Cambio di brano: catalogo e fotografia della coda, da dove si riprende. */
function handleTransition(item: MediaItem | null): void {
  clearPlaybackFault();
  cancelNetworkRetry();
  listenedId = null;
  rememberItem(item);
  saveQueueSnapshot();
}

/** Il player si e' rimesso a caricare: l'errore precedente e' superato. */
function handleStateChanged({ state }: PlaybackStateChangedEvent): void {
  if (state !== 'idle') clearPlaybackFault();
}

/**
 * Tick del timer nativo di progresso (vedi setupPlayer): la posizione va su
 * disco e, superata la soglia di ascolto (historyPolicy), il brano entra in
 * cronologia. Non al cambio di brano: un brano saltato non è un ascolto.
 */
function handleProgress({ mediaId, position, duration }: PlaybackProgressUpdatedEvent): void {
  savePosition(mediaId, position);
  if (!mediaId || listenedId === mediaId) return;
  if (!reachedListen(position, duration)) return;
  listenedId = mediaId;
  // Trenta secondi di scroll possono aver sfrattato il brano dal catalogo
  // volatile: il media item lo porta con sé, e da lì si rimette a posto.
  const item = TrackPlayer.getActiveMediaItem();
  if (item?.mediaId === mediaId) rememberItem(item);
  recordPlay(mediaId);
}

function handlePlaybackError(error: PlaybackErrorEvent): void {
  console.warn(`[player] ${error.code}: ${error.message}`);

  const decision = decideSkip({
    code: error.code,
    skipsUsed: sourceSkips,
    queue: () => ({
      index: TrackPlayer.getActiveMediaItemIndex(),
      length: TrackPlayer.getQueue().length,
    }),
  });
  if (decision !== 'salta') {
    markPlaybackFault();
    if (error.code === 'network') scheduleNetworkRetry();
    return;
  }

  sourceSkips++;
  // Dopo un errore ExoPlayer e' `idle`: spostare l'indice e chiamare play()
  // non basta, la sorgente nuova va preparata, ed e' cio' che fa `retry`.
  TrackPlayer.skipToNext();
  TrackPlayer.retry();
  TrackPlayer.play();
}

function handleIsPlayingChanged({ playing }: IsPlayingChangedEvent): void {
  sourceSkips = budgetAfterPlayingChange(playing, sourceSkips);
  if (playing) {
    // Suona di nuovo: i tentativi ripartono da zero per il prossimo tunnel.
    networkRetries = 0;
    cancelNetworkRetry();
  }
}

/** Listener del processo UI; gli eventi background arrivano al gestore sotto. */
export function startForegroundPlaybackListeners(): void {
  if (foregroundListenersStarted) return;
  foregroundListenersStarted = true;

  TrackPlayer.addEventListener(Event.MediaItemTransition, ({ item }) => {
    handleTransition(item);
  });
  TrackPlayer.addEventListener(Event.QueueChanged, saveQueueSnapshot);
  TrackPlayer.addEventListener(Event.PlaybackProgressUpdated, handleProgress);
  TrackPlayer.addEventListener(Event.PlaybackError, handlePlaybackError);
  TrackPlayer.addEventListener(Event.IsPlayingChanged, handleIsPlayingChanged);
  TrackPlayer.addEventListener(Event.PlaybackStateChanged, handleStateChanged);
}

/** Gestore Headless JS Android, registrato in index.js. */
export async function playbackService(event: BackgroundEvent): Promise<void> {
  if (event.type === Event.MediaItemTransition) {
    handleTransition(event.item);
  } else if (event.type === Event.QueueChanged) {
    saveQueueSnapshot();
  } else if (event.type === Event.PlaybackProgressUpdated) {
    handleProgress(event);
  } else if (event.type === Event.PlaybackError) {
    handlePlaybackError(event);
  } else if (event.type === Event.IsPlayingChanged) {
    handleIsPlayingChanged(event);
  }
}

/** Coda nuova, budget nuovo: chiamato da useQueue quando si riparte da zero. */
export function resetPlaybackErrorBudget(): void {
  sourceSkips = 0;
}

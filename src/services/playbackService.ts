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
import { budgetAfterPlayingChange, decideSkip } from './playbackPolicy';

/** Salti consumati dall'ultima riproduzione riuscita. La regola sta in playbackPolicy. */
let sourceSkips = 0;
let foregroundListenersStarted = false;

function rememberAndRecord(item: MediaItem | null): void {
  if (!item?.mediaId) return;
  const track = item.extras?.track as Track | undefined;
  if (track?.uid === item.mediaId) remember([track]);
  recordPlay(item.mediaId);
}

/** Cambio di brano: cronologia e fotografia della coda, da dove si riprende. */
function handleTransition(item: MediaItem | null): void {
  clearPlaybackFault();
  rememberAndRecord(item);
  saveQueueSnapshot();
}

/** Il player si e' rimesso a caricare: l'errore precedente e' superato. */
function handleStateChanged({ state }: PlaybackStateChangedEvent): void {
  if (state !== 'idle') clearPlaybackFault();
}

/** Tick del timer nativo di progresso (vedi setupPlayer): la posizione va su disco. */
function handleProgress({ mediaId, position }: PlaybackProgressUpdatedEvent): void {
  savePosition(mediaId, position);
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

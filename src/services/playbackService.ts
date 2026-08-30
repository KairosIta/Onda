import TrackPlayer, {
  Event,
  type BackgroundEvent,
  type IsPlayingChangedEvent,
  type MediaItem,
  type PlaybackErrorEvent,
} from '@rntp/player';
import { recordPlay, remember } from '@/store/library';
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
  if (decision !== 'salta') return;

  sourceSkips++;
  TrackPlayer.skipToNext();
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
    rememberAndRecord(item);
  });
  TrackPlayer.addEventListener(Event.PlaybackError, handlePlaybackError);
  TrackPlayer.addEventListener(Event.IsPlayingChanged, handleIsPlayingChanged);
}

/** Gestore Headless JS Android, registrato in index.js. */
export async function playbackService(event: BackgroundEvent): Promise<void> {
  if (event.type === Event.MediaItemTransition) {
    rememberAndRecord(event.item);
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

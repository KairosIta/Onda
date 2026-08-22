import TrackPlayer, {
  Event,
  type BackgroundEvent,
  type MediaItem,
  type PlaybackErrorEvent,
} from '@rntp/player';
import { recordPlay, remember } from '@/store/library';
import type { Track } from '@/types/track';

const MAX_SOURCE_SKIPS = 3;
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

  // Una caduta di rete e' recuperabile: non deve divorare la coda.
  if (error.code === 'network' || error.code === 'play-not-permitted') return;
  if (sourceSkips >= MAX_SOURCE_SKIPS) return;

  const index = TrackPlayer.getActiveMediaItemIndex();
  const queue = TrackPlayer.getQueue();
  if (index === null || index >= queue.length - 1) return;

  sourceSkips++;
  TrackPlayer.skipToNext();
  TrackPlayer.play();
}

/** Listener del processo UI; gli eventi background arrivano al gestore sotto. */
export function startForegroundPlaybackListeners(): void {
  if (foregroundListenersStarted) return;
  foregroundListenersStarted = true;

  TrackPlayer.addEventListener(Event.MediaItemTransition, ({ item }) => {
    rememberAndRecord(item);
  });
  TrackPlayer.addEventListener(Event.PlaybackError, handlePlaybackError);
}

/** Gestore Headless JS Android, registrato in index.js. */
export async function playbackService(event: BackgroundEvent): Promise<void> {
  if (event.type === Event.MediaItemTransition) {
    rememberAndRecord(event.item);
  } else if (event.type === Event.PlaybackError) {
    handlePlaybackError(event);
  }
}
export function resetPlaybackErrorBudget(): void {
  sourceSkips = 0;
}

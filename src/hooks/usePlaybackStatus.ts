import { useIsPlaying, usePlaybackState } from '@rntp/player';
import { derivePlaybackStatus, type PlaybackStatus } from '@/services/playbackStatus';
import { useNowPlaying } from '@/store/session';

/** Lo stato unico del tasto play; la tabella sta in `services/playbackStatus`. */
export function usePlaybackStatus(): PlaybackStatus {
  const state = usePlaybackState();
  const playing = useIsPlaying();
  const { item, pending } = useNowPlaying();
  return derivePlaybackStatus({ state, playing, hasItem: item !== null, pending });
}

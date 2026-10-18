import type { RepeatMode } from '@/player';
import { isRecord } from '@/utils/validate';

export interface PlaybackPrefs {
  shuffle: boolean;
  repeat: RepeatMode;
}

/** Valida il formato corrente e migra i vecchi valori numerici di repeat. */
export function loadPlaybackPrefs(value: unknown): PlaybackPrefs {
  const saved = isRecord(value) ? value : {};
  const repeat: RepeatMode =
    saved.repeat === 'off' || saved.repeat === 0
      ? 'off'
      : saved.repeat === 'one' || saved.repeat === 1
        ? 'one'
        : saved.repeat === 'all' || saved.repeat === 2
          ? 'all'
          : 'off';

  return {
    shuffle: typeof saved.shuffle === 'boolean' ? saved.shuffle : false,
    repeat,
  };
}

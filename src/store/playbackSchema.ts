import type { RepeatMode } from '@/player';

export interface PlaybackPrefs {
  shuffle: boolean;
  repeat: RepeatMode;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

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

export interface RepeatModes<T> {
  off: T;
  one: T;
  all: T;
}

export interface LoadedPlaybackPrefs<T> {
  shuffle: boolean;
  repeat: T;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Valida il formato corrente e migra i vecchi valori numerici di repeat. */
export function loadPlaybackPrefs<T>(
  value: unknown,
  modes: RepeatModes<T>,
): LoadedPlaybackPrefs<T> {
  const saved = isRecord(value) ? value : {};
  const repeat =
    saved.repeat === modes.off || saved.repeat === 0
      ? modes.off
      : saved.repeat === modes.one || saved.repeat === 1
        ? modes.one
        : saved.repeat === modes.all || saved.repeat === 2
          ? modes.all
          : modes.off;

  return {
    shuffle: typeof saved.shuffle === 'boolean' ? saved.shuffle : false,
    repeat,
  };
}

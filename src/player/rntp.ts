import TrackPlayer, {
  Event,
  type EventPayloadByEvent,
  type MediaItem as RntpMediaItem,
  PlaybackState as RntpPlaybackState,
  PlayerCommand,
  RepeatMode as RntpRepeatMode,
  useIsPlaying,
  usePlaybackState as useRntpPlaybackState,
} from '@rntp/player';
import type { PlayerBackend } from './backend';
import type {
  MediaItem,
  PlaybackState,
  PlayerEvent,
  PlayerEventName,
  PlayerEventOf,
  PlayerEvents,
  RemoteCommand,
  RepeatMode,
} from './types';

/**
 * Il contratto del player (`backend.ts`) sopra React Native Track Player.
 * Deve restare l'unico file dell'app che importa `@rntp/player`. Qui si
 * traduce e basta, le regole di Onda stanno fuori.
 */

const REPEAT: Record<RepeatMode, RntpRepeatMode> = {
  off: RntpRepeatMode.Off,
  one: RntpRepeatMode.One,
  all: RntpRepeatMode.All,
};

const STATE: Record<RntpPlaybackState, PlaybackState> = {
  [RntpPlaybackState.Idle]: 'idle',
  [RntpPlaybackState.Ready]: 'ready',
  [RntpPlaybackState.Buffering]: 'buffering',
  [RntpPlaybackState.Ended]: 'ended',
  [RntpPlaybackState.Error]: 'error',
};

const COMMAND: Record<RemoteCommand, PlayerCommand> = {
  'play-pause': PlayerCommand.PlayPause,
  next: PlayerCommand.Next,
  previous: PlayerCommand.Previous,
  seek: PlayerCommand.Seek,
  stop: PlayerCommand.Stop,
};

const EVENT = {
  isPlayingChanged: Event.IsPlayingChanged,
  playbackStateChanged: Event.PlaybackStateChanged,
  mediaItemTransition: Event.MediaItemTransition,
  mediaMetadataChanged: Event.MediaMetadataChanged,
  queueChanged: Event.QueueChanged,
  playbackError: Event.PlaybackError,
  progressUpdated: Event.PlaybackProgressUpdated,
} as const satisfies Record<PlayerEventName, Event>;

/** Un elemento di RNTP gia' convertito resta lo stesso oggetto (vedi fromRntp). */
const converted = new WeakMap<RntpMediaItem, MediaItem>();

/**
 * RNTP restituisce solo i campi che gli abbiamo dato, ma li tipizza larghi
 * (un url puo' essere una risorsa locale): si tiene la forma che Onda usa.
 *
 * Allo stesso elemento di RNTP corrisponde sempre lo stesso oggetto:
 * `store/session` riconosce per identita' il brano attivo invariato, e una
 * copia nuova a ogni lettura ridisegnerebbe le schermate per niente.
 */
function fromRntp(item: RntpMediaItem): MediaItem {
  const cached = converted.get(item);
  if (cached) return cached;
  const ours: MediaItem = {
    mediaId: item.mediaId ?? '',
    url: typeof item.url === 'string' ? item.url : '',
    title: item.title,
    artist: item.artist,
    artworkUrl: typeof item.artworkUrl === 'string' ? item.artworkUrl : undefined,
    duration: item.duration,
    extras: item.extras,
  };
  converted.set(item, ours);
  return ours;
}

/**
 * Il payload di ogni evento RNTP nella forma di Onda. La mappa e' completa
 * per costruzione: un evento aggiunto al contratto e dimenticato qui non
 * compila.
 */
const CONVERT: {
  [K in PlayerEventName]: (payload: EventPayloadByEvent[(typeof EVENT)[K]]) => PlayerEvents[K];
} = {
  isPlayingChanged: ({ playing }) => ({ playing }),
  playbackStateChanged: ({ state }) => ({ state: STATE[state] }),
  mediaItemTransition: ({ item }) => ({ item: item && fromRntp(item) }),
  mediaMetadataChanged: () => ({}),
  queueChanged: () => ({}),
  playbackError: ({ code, message }) => ({ code, message }),
  progressUpdated: ({ mediaId, position, duration }) => ({ mediaId, position, duration }),
};

const NAME_OF = new Map<Event, PlayerEventName>(
  (Object.keys(EVENT) as PlayerEventName[]).map((name) => [EVENT[name], name]),
);

/**
 * `payload` e' quello dell'evento RNTP che corrisponde a `name`: chi
 * chiama lo garantisce, ma TypeScript non segue il legame fra i due.
 */
function convert<K extends PlayerEventName>(name: K, payload: unknown): PlayerEventOf<K> {
  const fromRntpPayload = CONVERT[name] as (payload: unknown) => PlayerEvents[K];
  return { type: name, ...fromRntpPayload(payload) };
}

export const backend: PlayerBackend = {
  setup({ progressIntervalSeconds, commands }) {
    TrackPlayer.setupPlayer({
      contentType: 'music',
      handleAudioBecomingNoisy: true,
      audioMixing: 'exclusive',
      // Senza `http` il timer non manda niente fuori dal telefono.
      progressSync: { intervalSeconds: progressIntervalSeconds },
      android: {
        wakeMode: 'network',
        taskRemovedBehavior: 'stop',
      },
    });
    TrackPlayer.setCommands({
      capabilities: commands.map((c) => COMMAND[c]),
      handling: 'native',
    });
  },

  registerBackgroundHandler(handler) {
    TrackPlayer.registerBackgroundEventHandler(() => async (event) => {
      // Gli eventi che Onda non usa (i tasti remoti, gestiti dal nativo) si
      // fermano qui.
      const name = NAME_OF.get(event.type);
      if (name) await handler(convert(name, event) as PlayerEvent);
    });
  },

  subscribe<K extends PlayerEventName>(name: K, listener: (event: PlayerEventOf<K>) => void) {
    // Con il tipo largo RNTP accetta un listener sul payload di qualunque
    // evento; quello giusto lo sceglie `convert`.
    const type: Event = EVENT[name];
    const subscription = TrackPlayer.addEventListener(
      type,
      (payload?: EventPayloadByEvent[Event]) => listener(convert(name, payload)),
    );
    return () => subscription.remove();
  },

  play: () => TrackPlayer.play(),
  pause: () => TrackPlayer.pause(),
  seekTo: (seconds) => TrackPlayer.seekTo(seconds),
  skipToNext: () => TrackPlayer.skipToNext(),
  skipToPrevious: () => TrackPlayer.skipToPrevious(),
  skipToIndex: (index) => TrackPlayer.skipToIndex(index),
  retry: () => TrackPlayer.retry(),

  setMediaItems: (items, startIndex) => TrackPlayer.setMediaItems(items, startIndex),
  addMediaItem: (item) => TrackPlayer.addMediaItem(item),
  insertMediaItem: (index, item) => TrackPlayer.insertMediaItem(index, item),
  insertMediaItems: (index, items) => TrackPlayer.insertMediaItems(index, items),
  removeMediaItem: (index) => TrackPlayer.removeMediaItem(index),
  removeMediaItems: (from, to) => TrackPlayer.removeMediaItems(from, to),
  moveMediaItem: (from, to) => TrackPlayer.moveMediaItem(from, to),

  getQueue: () => TrackPlayer.getQueue().map(fromRntp),
  getActiveMediaItem: () => {
    const item = TrackPlayer.getActiveMediaItem();
    return item && fromRntp(item);
  },
  getActiveIndex: () => TrackPlayer.getActiveMediaItemIndex(),
  getProgress: () => {
    const { position, duration, buffered } = TrackPlayer.getProgress();
    return { position, duration, buffered };
  },
  isPlaying: () => TrackPlayer.isPlaying(),

  setRepeatMode: (mode) => TrackPlayer.setRepeatMode(REPEAT[mode]),
  setShuffleModeEnabled: (enabled) => TrackPlayer.setShuffleEnabled(enabled),

  sleepAfter: (seconds) => TrackPlayer.sleepAfterTime(seconds),
  cancelSleep: () => TrackPlayer.cancelSleepTimer(),

  setBrowseTree: (categories) => TrackPlayer.setBrowseTree(categories),

  usePlaybackState: () => STATE[useRntpPlaybackState()],
  useIsPlaying,
};

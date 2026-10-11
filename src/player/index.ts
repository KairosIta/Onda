import type { PlayerControls } from './backend';
import { backend } from './media3';

/**
 * Il player di Onda. L'app deve passare da qui e mai dal modulo nativo:
 * cosi' cambiare modulo vuol dire scrivere un altro backend (`backend.ts`)
 * e cambiare l'import qui sopra.
 */
export const player: PlayerControls = backend;

/** Lo stato del player, per i componenti. */
export const usePlaybackState = backend.usePlaybackState;
/** Se sta davvero uscendo audio, per i componenti. */
export const useIsPlaying = backend.useIsPlaying;

export type {
  BrowseCategory,
  BrowseItem,
  MediaItem,
  PlaybackErrorCode,
  PlaybackState,
  PlayerEvent,
  PlayerEventName,
  PlayerEventOf,
  PlayerEvents,
  PlayerSetup,
  Progress,
  RemoteCommand,
  RepeatMode,
} from './types';

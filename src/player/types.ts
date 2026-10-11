/**
 * I tipi del player come li intende Onda, indipendenti dal modulo nativo
 * che sta sotto. I nomi seguono Media3, su cui si appoggera' il modulo
 * nostro; i campi sono solo quelli che l'app legge o scrive davvero.
 */

/** Un brano come lo vede il player. Tempi in secondi. */
export interface MediaItem {
  /** L'uid del brano (`sorgente:id`); stringa vuota se l'elemento non e' nostro. */
  mediaId: string;
  url: string;
  title?: string;
  artist?: string;
  artworkUrl?: string;
  duration?: number;
  /** Viaggia con il brano e torna indietro intatto (vedi `services/mediaItems`). */
  extras?: Record<string, unknown>;
}

/**
 * Posizione, durata e porzione bufferizzata del brano attivo, in secondi.
 * La durata vale 0 finche' il nativo non la conosce: `store/progress` ci
 * conta per ripiegare su quella dichiarata dalla sorgente.
 */
export interface Progress {
  position: number;
  duration: number;
  buffered: number;
}

export type RepeatMode = 'off' | 'one' | 'all';

/**
 * Lo stato del player. Su Android dopo un errore arriva `idle`, non
 * `error`: per questo esiste `store/playbackFault`.
 */
export type PlaybackState = 'idle' | 'ready' | 'buffering' | 'ended' | 'error';

/**
 * La categoria di un errore, da cui `playbackPolicy` decide se riprovare o
 * saltare il brano (finche' basta il suo budget di salti):
 * - `network`: problema di rete passeggero (timeout, connessione caduta);
 *   si riprova;
 * - `source`: il brano non si puo' leggere (404, formato non supportato);
 *   si salta;
 * - `renderer`: guasto del decoder o dell'uscita audio; si salta;
 * - `unknown`: non classificato; si salta.
 */
export type PlaybackErrorCode = 'network' | 'source' | 'renderer' | 'unknown';

/**
 * I comandi che notifica, schermata di blocco, cuffie e Android Auto possono
 * dare. `stop` ferma la riproduzione e lascia la coda.
 */
export type RemoteCommand = 'play-pause' | 'next' | 'previous' | 'seek' | 'stop';

/** Una voce dell'albero di Android Auto: un brano, o una cartella con `children`. */
export interface BrowseItem {
  mediaId: string;
  title: string;
  artist?: string;
  artworkUrl?: string;
  url?: string;
  duration?: number;
  children?: BrowseItem[];
}

/** Una scheda dell'albero di Android Auto. */
export interface BrowseCategory {
  mediaId: string;
  title: string;
  items: BrowseItem[];
}

type NoPayload = Record<never, never>;

/** Gli eventi del player e cosa portano. */
export interface PlayerEvents {
  isPlayingChanged: { playing: boolean };
  playbackStateChanged: { state: PlaybackState };
  /**
   * Cambio di brano, anche quando lo stesso brano ricomincia con `one`;
   * `null` quando la coda si svuota.
   */
  mediaItemTransition: { item: MediaItem | null };
  mediaMetadataChanged: NoPayload;
  queueChanged: NoPayload;
  playbackError: { code: PlaybackErrorCode; message: string };
  /**
   * Il timer nativo di posizione (`PlayerSetup.progressIntervalSeconds`):
   * un colpo a intervallo fisso in riproduzione e uno alla pausa, anche a
   * schermo spento. Con l'app non in primo piano arriva al gestore in
   * background.
   */
  progressUpdated: { mediaId: string; position: number; duration: number };
}

export type PlayerEventName = keyof PlayerEvents;

/** Un evento con il suo nome in `type`, come lo ricevono listener e gestore in background. */
export type PlayerEventOf<K extends PlayerEventName> = { type: K } & PlayerEvents[K];

export type PlayerEvent = { [K in PlayerEventName]: PlayerEventOf<K> }[PlayerEventName];

export interface PlayerSetup {
  /** Ogni quanti secondi, in riproduzione, arriva `progressUpdated`. */
  progressIntervalSeconds: number;
  /** I tasti esposti all'esterno; li esegue il nativo, senza passare dal JS. */
  commands: readonly RemoteCommand[];
}

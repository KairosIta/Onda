/**
 * Un solo stato per il tasto play, ricavato dai tre segnali che RNTP
 * espone separatamente: lo stato del player (`idle/ready/buffering/ended/
 * error`), se sta davvero uscendo audio e se c'e' un brano caricato.
 *
 * Modulo puro: i due tasti play dell'app (mini-player e player) leggono lo
 * stesso stato e reagiscono allo stesso modo, e la tabella si verifica
 * senza device.
 */

export type PlaybackStatus =
  /** Nessun brano: il mini-player non c'e'. */
  | 'idle'
  /** Sta caricando, all'avvio del brano o dopo un buco di rete. */
  | 'buffering'
  | 'playing'
  | 'paused'
  /** Coda finita: play riparte dal brano corrente. */
  | 'ended'
  /** Il brano non risponde: play ritenta. */
  | 'error';

export interface PlaybackSignals {
  /** `PlaybackState` di RNTP, come stringa per restare fuori da React Native. */
  state: string;
  playing: boolean;
  hasItem: boolean;
  /** Coda ripristinata dal disco ma non ancora caricata nel player. */
  pending: boolean;
}

export function derivePlaybackStatus({
  state,
  playing,
  hasItem,
  pending,
}: PlaybackSignals): PlaybackStatus {
  // La coda in attesa e' un brano in pausa a tutti gli effetti: il player
  // nativo non lo sa ancora, ma per chi guarda lo schermo non cambia niente.
  if (pending) return 'paused';
  if (!hasItem) return 'idle';
  // Gli stati eccezionali vincono su `playing`, che durante un buffering
  // e' comunque falso: ExoPlayer considera "playing" solo l'audio che esce.
  if (state === 'error') return 'error';
  if (state === 'buffering') return 'buffering';
  if (state === 'ended') return 'ended';
  return playing ? 'playing' : 'paused';
}

export interface PlayButton {
  icon: 'play' | 'pause' | 'refresh';
  label: string;
  /** Sta caricando: l'icona lascia il posto a un indicatore. */
  busy: boolean;
}

/**
 * Icona ed etichetta del tasto play per ogni stato. Durante il buffering
 * il tasto resta "pausa": chi tocca uno spinner vuole fermare il
 * caricamento, non farlo ripartire.
 */
export function describePlayButton(status: PlaybackStatus): PlayButton {
  switch (status) {
    case 'playing':
      return { icon: 'pause', label: 'Metti in pausa', busy: false };
    case 'buffering':
      return { icon: 'pause', label: 'Caricamento, tocca per mettere in pausa', busy: true };
    case 'error':
      return { icon: 'refresh', label: 'Il brano non risponde, riprova', busy: false };
    case 'ended':
      return { icon: 'play', label: 'Riascolta', busy: false };
    default:
      return { icon: 'play', label: 'Riprendi', busy: false };
  }
}

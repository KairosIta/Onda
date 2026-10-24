import { type MediaItem, player, type PlayerEvent, type PlayerEvents } from '@/player';
import { recordPlay, remember } from '@/store/library';
import { clearPlaybackFault, markPlaybackFault } from '@/store/playbackFault';
import { savePosition, saveQueueSnapshot } from '@/store/session';
import type { Track } from '@/types/track';
import { reachedListen } from './historyPolicy';
import { budgetAfterPlayingChange, decideSkip, networkRetryDelay } from './playbackPolicy';

/** Salti consumati dall'ultima riproduzione riuscita. La regola sta in playbackPolicy. */
let sourceSkips = 0;
let foregroundListenersStarted = false;
/** Il brano già messo in cronologia in questa visita: si registra una volta sola. */
let listenedId: string | null = null;
/** Tentativi automatici dopo un errore di rete, e se il prossimo e' in attesa. */
let networkRetries = 0;
let networkRetryPending = false;

function cancelNetworkRetry(): void {
  if (!networkRetryPending) return;
  networkRetryPending = false;
  player.cancelRetry();
}

/**
 * Riprepara la sorgente e riparte, la stessa mossa del tasto Riprova. Il
 * timer e' nel player: con l'app in background quelli JS sono fermi, ed e'
 * proprio a schermo spento che si attraversa un tunnel.
 */
function scheduleNetworkRetry(): void {
  const delay = networkRetryDelay(networkRetries);
  if (delay === null) return;
  networkRetries++;
  networkRetryPending = true;
  player.scheduleRetry(delay / 1000);
}

/**
 * Il catalogo volatile deve conoscere il brano subito, non alla soglia:
 * la cronologia lo risolve per uid, e la Coda o Android Auto possono
 * averlo messo in riproduzione senza che una lista lo abbia mai mostrato.
 */
function rememberItem(item: MediaItem | null): void {
  const track = item?.extras?.track as Track | undefined;
  if (track && track.uid === item?.mediaId) remember([track]);
}

/** Cambio di brano: catalogo e fotografia della coda, da dove si riprende. */
function handleTransition(item: MediaItem | null): void {
  clearPlaybackFault();
  cancelNetworkRetry();
  listenedId = null;
  rememberItem(item);
  saveQueueSnapshot();
}

/** Il player si e' rimesso a caricare: l'errore precedente e' superato. */
function handleStateChanged({ state }: PlayerEvents['playbackStateChanged']): void {
  if (state !== 'idle') clearPlaybackFault();
}

/**
 * Tick del timer nativo di progresso (vedi setupPlayer): la posizione va su
 * disco e, superata la soglia di ascolto (historyPolicy), il brano entra in
 * cronologia. Non al cambio di brano: un brano saltato non è un ascolto.
 */
function handleProgress({ mediaId, position, duration }: PlayerEvents['progressUpdated']): void {
  savePosition(mediaId, position);
  if (!mediaId || listenedId === mediaId) return;
  if (!reachedListen(position, duration)) return;
  listenedId = mediaId;
  // Trenta secondi di scroll possono aver sfrattato il brano dal catalogo
  // volatile: il media item lo porta con sé, e da lì si rimette a posto.
  const item = player.getActiveMediaItem();
  if (item?.mediaId === mediaId) rememberItem(item);
  recordPlay(mediaId);
}

function handlePlaybackError(error: PlayerEvents['playbackError']): void {
  console.warn(`[player] ${error.code}: ${error.message}`);

  const decision = decideSkip({ code: error.code, skipsUsed: sourceSkips });
  if (decision !== 'salta') {
    markPlaybackFault();
    if (error.code === 'network') scheduleNetworkRetry();
    return;
  }

  // Il nativo decide sul main thread, anche se esista un brano dopo (con
  // lo shuffle e «ripeti tutto» l'indice lineare non lo dice): `isPlaying`
  // e' falso anche durante il buffering e non dice se l'utente ha chiesto
  // una pausa. Tre comandi JS separati potrebbero invece riavviare dopo
  // una pausa del controller. Un salto non eseguito non consuma budget.
  if (player.skipToNextAfterError()) sourceSkips++;
  else markPlaybackFault();
}

function handleIsPlayingChanged({ playing }: PlayerEvents['isPlayingChanged']): void {
  sourceSkips = budgetAfterPlayingChange(playing, sourceSkips);
  if (playing) {
    // Suona di nuovo: i tentativi ripartono da zero per il prossimo tunnel.
    networkRetries = 0;
    cancelNetworkRetry();
  }
}

/** Listener del processo UI; gli eventi background arrivano al gestore sotto. */
export function startForegroundPlaybackListeners(): void {
  if (foregroundListenersStarted) return;
  foregroundListenersStarted = true;

  player.subscribe('mediaItemTransition', ({ item }) => {
    handleTransition(item);
  });
  player.subscribe('queueChanged', saveQueueSnapshot);
  player.subscribe('progressUpdated', handleProgress);
  player.subscribe('playbackError', handlePlaybackError);
  player.subscribe('isPlayingChanged', handleIsPlayingChanged);
  player.subscribe('playbackStateChanged', handleStateChanged);
}

/**
 * Il gestore degli eventi con l'app in background, registrato in index.js.
 * Sincrono per contratto (`registerBackgroundHandler`): in background i
 * timer JS sono fermi, e le attese le conta il player.
 */
export function playbackService(event: PlayerEvent): void {
  if (event.type === 'mediaItemTransition') {
    handleTransition(event.item);
  } else if (event.type === 'queueChanged') {
    saveQueueSnapshot();
  } else if (event.type === 'progressUpdated') {
    handleProgress(event);
  } else if (event.type === 'playbackError') {
    handlePlaybackError(event);
  } else if (event.type === 'isPlayingChanged') {
    handleIsPlayingChanged(event);
  } else if (event.type === 'playbackStateChanged') {
    handleStateChanged(event);
  }
}

/** Coda nuova, budget nuovo: chiamato da useQueue quando si riparte da zero. */
export function resetPlaybackErrorBudget(): void {
  sourceSkips = 0;
}

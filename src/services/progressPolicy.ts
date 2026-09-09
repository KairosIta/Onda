/**
 * Quanto spesso leggere la posizione dal player nativo. Un solo timer per
 * tutta l'app (vedi `store/progress.ts`): prima mini-player e player
 * interrogavano il bridge ciascuno per conto proprio, ogni mezzo secondo,
 * anche con la musica ferma e con l'app in background.
 */

/** In riproduzione: abbastanza fitto perche' slider e tempi non scattino. */
export const PROGRESS_PLAYING_MS = 500;
/**
 * In pausa la posizione cambia solo per un seek dalla notifica: basta
 * accorgersene entro un paio di secondi.
 */
export const PROGRESS_PAUSED_MS = 2000;

export interface ProgressDemand {
  /** Componenti montati che stanno leggendo il progresso. */
  subscribers: number;
  hasTrack: boolean;
  /** App in primo piano: in background nessuno guarda lo slider. */
  appActive: boolean;
  playing: boolean;
}

/** Intervallo di lettura in millisecondi, o `null` per non leggere affatto. */
export function progressPollInterval({
  subscribers,
  hasTrack,
  appActive,
  playing,
}: ProgressDemand): number | null {
  if (subscribers === 0 || !hasTrack || !appActive) return null;
  return playing ? PROGRESS_PLAYING_MS : PROGRESS_PAUSED_MS;
}

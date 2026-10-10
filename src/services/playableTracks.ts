import type { SourceId, Track } from '@/types/track';

/**
 * Cosa si puo' mettere nel player quando una sorgente e' spenta. I brani
 * salvati restano in preferiti, playlist e cronologia, e tornano quando la
 * sorgente si riaccende; ma il player non deve riceverli da nessuna strada.
 * Prima lo stream salvato nel brano bastava a suonarlo, e un preferito di
 * Jamendo partiva anche a Jamendo spenta.
 *
 * Modulo puro: chi e' attivo lo decide il chiamante (`isSourceAvailable`
 * nell'app, un elenco fisso nei test).
 */

export type IsSourceActive = (id: SourceId) => boolean;

/**
 * La coda da dare al player: i soli brani di sorgenti attive, partendo dal
 * brano scelto. Se il brano scelto non e' suonabile si parte dal primo
 * suonabile dopo di lui, o in mancanza dall'ultimo prima: cosi' «Riproduci»
 * su una raccolta che comincia con un brano spento parte comunque.
 * `null` se non resta niente da suonare.
 */
export function playableQueue(
  tracks: readonly Track[],
  startIndex: number,
  isActive: IsSourceActive,
): { tracks: Track[]; index: number } | null {
  const kept: Track[] = [];
  let index = -1;
  tracks.forEach((track, i) => {
    if (!isActive(track.source)) return;
    if (index < 0 && i >= startIndex) index = kept.length;
    kept.push(track);
  });
  if (kept.length === 0) return null;
  return { tracks: kept, index: index < 0 ? kept.length - 1 : index };
}

/**
 * I tratti della coda del player da togliere perche' la loro sorgente si e'
 * spenta, come intervalli `[from, to)` dall'ultimo al primo: toglierli in
 * quest'ordine non sposta gli indici di quelli ancora da togliere. Un
 * elemento senza sorgente riconoscibile (`null`) non e' nostro e resta.
 */
export function inactiveRuns(
  sources: readonly (SourceId | null)[],
  isActive: IsSourceActive,
): [number, number][] {
  const runs: [number, number][] = [];
  let start = -1;
  sources.forEach((source, i) => {
    const off = source !== null && !isActive(source);
    if (off && start < 0) start = i;
    if (!off && start >= 0) {
      runs.push([start, i]);
      start = -1;
    }
  });
  if (start >= 0) runs.push([start, sources.length]);
  return runs.reverse();
}

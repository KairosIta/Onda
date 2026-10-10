import TrackPlayer from '@rntp/player';
import { prunePending } from '@/store/session';
import { getSources, subscribeSources } from '@/store/sources';
import { parseUid, SOURCE_IDS } from '@/types/track';
import { inactiveRuns } from './playableTracks';
import { isSourceAvailable } from './sources/access';

/**
 * Spegnere una sorgente, o toglierne la credenziale, la toglie anche dalla
 * riproduzione: i suoi brani escono dalla coda del player e da quella in
 * attesa. Se suonava uno di loro, il player passa al successivo che resta.
 * Preferiti, playlist e cronologia non si toccano: tornano suonabili quando
 * la sorgente si riaccende.
 */

let started = false;

function prunePlayer(): void {
  const sources = TrackPlayer.getQueue().map((item) =>
    item.mediaId ? (parseUid(item.mediaId)?.source ?? null) : null,
  );
  for (const [from, to] of inactiveRuns(sources, isSourceAvailable)) {
    TrackPlayer.removeMediaItems(from, to);
  }
}

/** Da chiamare una volta dopo setupPlayer. */
export function startSourceGuard(): void {
  if (started) return;
  started = true;

  // Con il servizio sopravvissuto a una ricarica del solo JS, la coda nel
  // player puo' venire da prima: si ripulisce subito.
  prunePlayer();

  let previous = getSources().active;
  subscribeSources(() => {
    const { active } = getSources();
    const switchedOff = SOURCE_IDS.some((id) => previous[id] && !active[id]);
    previous = active;
    if (!switchedOff) return;
    prunePending(isSourceAvailable);
    prunePlayer();
  });
}

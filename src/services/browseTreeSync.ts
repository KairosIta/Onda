import TrackPlayer from '@rntp/player';
import { getLibrary, subscribeLibrary } from '@/store/library';
import { subscribeSources } from '@/store/sources';
import { buildBrowseTree } from './browseTree';
import { isSourceAvailable } from './sources/access';

/**
 * Tiene l'albero di Android Auto allineato alla libreria e alle sorgenti
 * attive. Un preferito aggiunto al telefono compare in macchina senza
 * riavviare niente, e una sorgente spenta ne sparisce; le mutazioni
 * ravvicinate (un import, un riordino) si accorpano.
 */

const DELAY_MS = 500;

let started = false;
let timer: ReturnType<typeof setTimeout> | null = null;

function push(): void {
  timer = null;
  try {
    TrackPlayer.setBrowseTree(buildBrowseTree(getLibrary(), isSourceAvailable));
  } catch (error) {
    // L'albero e' un di piu': senza, l'app al telefono funziona uguale.
    console.warn('[auto] albero di navigazione non aggiornato', error);
  }
}

/** Da chiamare una volta dopo setupPlayer. */
export function startBrowseTreeSync(): void {
  if (started) return;
  started = true;
  push();
  const schedule = (): void => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(push, DELAY_MS);
  };
  subscribeLibrary(schedule);
  subscribeSources(schedule);
}

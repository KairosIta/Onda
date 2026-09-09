import TrackPlayer from '@rntp/player';
import { getLibrary, subscribeLibrary } from '@/store/library';
import { buildBrowseTree } from './browseTree';

/**
 * Tiene l'albero di Android Auto allineato alla libreria. Un preferito
 * aggiunto al telefono compare in macchina senza riavviare niente; le
 * mutazioni ravvicinate (un import, un riordino) si accorpano.
 */

const DELAY_MS = 500;

let started = false;
let timer: ReturnType<typeof setTimeout> | null = null;

function push(): void {
  timer = null;
  try {
    TrackPlayer.setBrowseTree(buildBrowseTree(getLibrary()));
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
  subscribeLibrary(() => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(push, DELAY_MS);
  });
}

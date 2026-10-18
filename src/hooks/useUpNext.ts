import { useEffect, useState } from 'react';
import { player } from '@/player';
import { onAppActive } from '@/services/appState';
import { usePlaybackPrefs } from '@/store/playback';
import { getPendingQueue, useNowPlaying } from '@/store/session';
import { describeUpNext, type UpNext, type UpNextInput } from '@/utils/upNext';

type QueueView = Pick<UpNextInput, 'items' | 'activeIndex'>;

/** La coda come titoli, dal player o dalla sessione in attesa. */
function readQueue(): QueueView {
  const pending = getPendingQueue();
  if (pending) {
    return {
      items: pending.tracks.map((t) => ({ title: t.title, artist: t.artist })),
      activeIndex: pending.index,
    };
  }
  return {
    items: player.getQueue().map((m) => ({ title: m.title ?? '', artist: m.artist ?? '' })),
    activeIndex: player.getActiveIndex(),
  };
}

/** Cosa viene dopo il brano corrente; la regola sta in `utils/upNext`. */
export function useUpNext(): UpNext {
  const { shuffle, repeat } = usePlaybackPrefs();
  const { item, pending } = useNowPlaying();
  const [queue, setQueue] = useState<QueueView>(readQueue);

  // Rilettura a ogni cambio di brano o di coda, e al ritorno in primo piano
  // (in background gli eventi vanno al gestore headless); `item` e
  // `pending` nelle dipendenze coprono la consegna della coda in attesa.
  useEffect(() => {
    const load = () => setQueue(readQueue());
    load();
    const stopQueue = player.subscribe('queueChanged', load);
    const stopTrack = player.subscribe('mediaItemTransition', load);
    const stopForeground = onAppActive(load);
    return () => {
      stopQueue();
      stopTrack();
      stopForeground();
    };
  }, [item, pending]);

  return describeUpNext({ ...queue, shuffle, repeat });
}

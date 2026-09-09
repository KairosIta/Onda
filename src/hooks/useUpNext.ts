import { useEffect, useState } from 'react';
import TrackPlayer, { Event, RepeatMode } from '@rntp/player';
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
    items: TrackPlayer.getQueue().map((m) => ({
      title: String(m.title ?? ''),
      artist: String(m.artist ?? ''),
    })),
    activeIndex: TrackPlayer.getActiveMediaItemIndex(),
  };
}

/** Cosa viene dopo il brano corrente; la regola sta in `utils/upNext`. */
export function useUpNext(): UpNext {
  const { shuffle, repeat } = usePlaybackPrefs();
  const { item, pending } = useNowPlaying();
  const [queue, setQueue] = useState<QueueView>(readQueue);

  // Rilettura a ogni cambio di brano o di coda; `item` e `pending` nelle
  // dipendenze coprono la consegna della coda in attesa al player.
  useEffect(() => {
    const load = () => setQueue(readQueue());
    load();
    const queueSub = TrackPlayer.addEventListener(Event.QueueChanged, load);
    const trackSub = TrackPlayer.addEventListener(Event.MediaItemTransition, load);
    return () => {
      queueSub.remove();
      trackSub.remove();
    };
  }, [item, pending]);

  return describeUpNext({
    ...queue,
    shuffle,
    repeat: repeat === RepeatMode.One ? 'one' : repeat === RepeatMode.All ? 'all' : 'off',
  });
}

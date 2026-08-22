import { type ReactElement, useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet } from 'react-native';
import { useActiveMediaItem } from '@rntp/player';
import { useQueue } from '@/hooks/useQueue';
import { remember, useLibrary } from '@/store/library';
import { spacing } from '@/theme';
import type { Track } from '@/types/track';
import { TrackActions } from './TrackActions';
import { TrackRow } from './TrackRow';

interface Props {
  tracks: Track[];
  header?: ReactElement | null;
  footer?: ReactElement | null;
  empty?: ReactElement | null;
  /** Se la lista e' una playlist, il menu contestuale offre "rimuovi da qui". */
  fromPlaylistId?: string;
  /** Default: sostituisce la coda con l'intera lista partendo da qui. */
  onPlay?: (index: number) => void;
  onEndReached?: () => void;
}

/**
 * Lista di tracce condivisa da tutte le schermate. Tiene lei
 * l'abbonamento alla libreria e al player: le righe restano `memo`
 * e ridisegnano solo quando cambia davvero qualcosa che le riguarda.
 */
export function TrackList({
  tracks,
  header,
  footer,
  empty,
  fromPlaylistId,
  onPlay,
  onEndReached,
}: Props) {
  const { playList } = useQueue();
  const active = useActiveMediaItem();
  const { favorites } = useLibrary();
  const [menuFor, setMenuFor] = useState<Track | null>(null);

  // Lookup O(1) invece di un includes() per riga.
  const favSet = useMemo(() => new Set(favorites), [favorites]);

  // Tiene il catalogo volatile allineato a cio' che e' passato a schermo,
  // cosi' la cronologia sa risolvere l'uid quando la traccia parte.
  useEffect(() => {
    remember(tracks);
  }, [tracks]);

  const handlePlay = useCallback(
    (_track: Track, index: number) => (onPlay ? onPlay(index) : playList(tracks, index)),
    [onPlay, playList, tracks],
  );
  const handleMore = useCallback((track: Track) => setMenuFor(track), []);
  const closeMenu = useCallback(() => setMenuFor(null), []);

  const renderItem = useCallback(
    ({ item, index }: { item: Track; index: number }) => (
      <TrackRow
        track={item}
        index={index}
        isActive={active?.mediaId === item.uid}
        isFavorite={favSet.has(item.uid)}
        onPress={handlePlay}
        onMore={handleMore}
      />
    ),
    [active?.mediaId, favSet, handleMore, handlePlay],
  );

  return (
    <>
      <FlatList
        data={tracks}
        keyExtractor={(t) => t.uid}
        renderItem={renderItem}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={header}
        ListFooterComponent={footer}
        ListEmptyComponent={empty}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.6}
        contentContainerStyle={styles.content}
        removeClippedSubviews
        initialNumToRender={12}
        windowSize={11}
      />

      <TrackActions track={menuFor} fromPlaylistId={fromPlaylistId} onClose={closeMenu} />
    </>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xxl, flexGrow: 1 },
});

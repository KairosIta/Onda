import { useRouter } from 'expo-router';
import { type ReactElement, useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet } from 'react-native';
import { type Snack, Snackbar } from './Snackbar';
import { useQueue } from '@/hooks/useQueue';
import { SOURCE_META } from '@/services/sources/meta';
import { remember, useLibrary } from '@/store/library';
import { useNowPlaying } from '@/store/session';
import { useSources } from '@/store/sources';
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
  const router = useRouter();
  const { playList } = useQueue();
  const { item: active } = useNowPlaying();
  const { favorites } = useLibrary();
  const { active: activeSources } = useSources();
  const [menuFor, setMenuFor] = useState<Track | null>(null);
  const [snack, setSnack] = useState<Snack | null>(null);

  // Lookup O(1) invece di un includes() per riga.
  const favSet = useMemo(() => new Set(favorites), [favorites]);

  // Tiene il catalogo volatile allineato a cio' che e' passato a schermo,
  // cosi' la cronologia sa risolvere l'uid quando la traccia parte.
  useEffect(() => {
    remember(tracks);
  }, [tracks]);

  const handlePlay = useCallback(
    (track: Track, index: number) => {
      // Un preferito o un brano in playlist di una sorgente spenta: si dice
      // perche' non parte e dove riaccenderla.
      if (!activeSources[track.source]) {
        setSnack({
          message: `${SOURCE_META[track.source].label} è spenta`,
          action: { label: 'Sorgenti', onPress: () => router.push('/sources') },
        });
        return;
      }
      if (onPlay) onPlay(index);
      else playList(tracks, index);
    },
    [activeSources, onPlay, playList, router, tracks],
  );
  const handleMore = useCallback((track: Track) => setMenuFor(track), []);
  const closeMenu = useCallback(() => setMenuFor(null), []);
  const dismissSnack = useCallback(() => setSnack(null), []);

  const renderItem = useCallback(
    ({ item, index }: { item: Track; index: number }) => (
      <TrackRow
        track={item}
        index={index}
        isActive={active?.mediaId === item.uid}
        isFavorite={favSet.has(item.uid)}
        unavailable={!activeSources[item.source]}
        onPress={handlePlay}
        onMore={handleMore}
      />
    ),
    [active?.mediaId, activeSources, favSet, handleMore, handlePlay],
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

      <TrackActions
        track={menuFor}
        fromPlaylistId={fromPlaylistId}
        onClose={closeMenu}
        onDone={setSnack}
      />
      {/* Sta in fondo al contenitore della schermata, che finisce sopra il
          mini-player e la tab bar: non copre mai i controlli. */}
      <Snackbar snack={snack} onDismiss={dismissSnack} />
    </>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xxl, flexGrow: 1 },
});

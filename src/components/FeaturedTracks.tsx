import Ionicons from '@expo/vector-icons/Ionicons';
import { useCallback, useRef, useState } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type ViewToken,
} from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { useQueue } from '@/hooks/useQueue';
import { SOURCE_META } from '@/services/sources/meta';
import { colors, motion, radius, spacing, type } from '@/theme';
import type { Track } from '@/types/track';
import { Artwork } from './Artwork';
import { ArtworkAtmosphere } from './ArtworkAtmosphere';
import { PressableScale } from './PressableScale';
import { FeaturedTracksSkeleton } from './Skeleton';

interface Props {
  tracks: Track[];
  loading?: boolean;
}

interface CarouselLayout {
  pageWidth: number;
  cardWidth: number;
  artworkSize: number;
  metadataHeight: number;
}

const VIEWABILITY_CONFIG = { itemVisiblePercentThreshold: 60 };

/**
 * Una pagina occupa tutta la larghezza dello scroller: margini e card sono
 * dentro la pagina, cosi' a riposo non spuntano pezzi del brano successivo.
 * Il tocco conserva coda completa e indice originale; lo swipe cambia solo
 * la scheda visibile, senza avviare la riproduzione.
 */
export function FeaturedTracks({ tracks, loading = false }: Props) {
  const { width, fontScale } = useWindowDimensions();
  const [pageWidth, setPageWidth] = useState(width);
  const cardWidth = Math.min(420, pageWidth - spacing.lg * 2);
  const layout: CarouselLayout = {
    pageWidth,
    cardWidth,
    artworkSize: Math.min(248, Math.max(0, cardWidth - spacing.lg * 2 - 2)),
    // Due righe di titolo, artista e sorgente: le card non cambiano altezza
    // durante lo swipe e continuano a rispettare i caratteri ingranditi.
    metadataHeight: (32 * 2 + 20 + 16) * fontScale + spacing.xs * 2,
  };

  if (!tracks.length && !loading) return null;

  return (
    <View style={styles.section} onLayout={(event) => setPageWidth(event.nativeEvent.layout.width)}>
      <Text style={styles.heading} accessibilityRole="header">
        In ascesa questa settimana
      </Text>
      {!tracks.length ? (
        <FeaturedTracksSkeleton
          width={cardWidth}
          artworkSize={layout.artworkSize}
          metadataHeight={layout.metadataHeight}
        />
      ) : (
        <TrackCarousel
          // Una raccolta diversa riparte dalla prima card, anche dopo aver
          // disattivato una sorgente. Un refresh degli stessi brani la conserva.
          key={tracks.map((track) => track.uid).join('|')}
          tracks={tracks}
          layout={layout}
        />
      )}
    </View>
  );
}

function TrackCarousel({ tracks, layout }: { tracks: Track[]; layout: CarouselLayout }) {
  const { playList } = useQueue();
  const reducedMotion = useReducedMotion();
  const list = useRef<FlatList<Track>>(null);
  const [page, setPage] = useState(0);
  // Su Android un nuovo gesto puo' interrompere l'evento di fine inerzia.
  // Pallini e accessibilita' seguono quindi la card davvero visibile.
  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken<Track>[] }) => {
      const visible = viewableItems.find((item) => item.isViewable && item.index !== null);
      if (visible?.index != null) setPage(visible.index);
    },
    [],
  );

  const goToPage = (next: number) => {
    const target = Math.max(0, Math.min(tracks.length - 1, next));
    list.current?.scrollToOffset({
      offset: target * layout.pageWidth,
      animated: !reducedMotion,
    });
    setPage(target);
  };

  return (
    <>
      <FlatList
        // In rotazione ricrea le misure native mantenendo la card corrente.
        key={layout.pageWidth}
        ref={list}
        horizontal
        pagingEnabled
        disableIntervalMomentum
        bounces={false}
        overScrollMode="never"
        style={styles.viewport}
        data={tracks}
        extraData={page}
        keyExtractor={(track) => track.uid}
        keyboardShouldPersistTaps="handled"
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        initialScrollIndex={page}
        getItemLayout={(_, index) => ({
          length: layout.pageWidth,
          offset: layout.pageWidth * index,
          index,
        })}
        viewabilityConfig={VIEWABILITY_CONFIG}
        onViewableItemsChanged={onViewableItemsChanged}
        initialNumToRender={2}
        maxToRenderPerBatch={2}
        windowSize={3}
        renderItem={({ item, index }) => (
          <View
            style={[styles.page, { width: layout.pageWidth }]}
            accessibilityElementsHidden={index !== page}
            importantForAccessibility={index === page ? 'auto' : 'no-hide-descendants'}
          >
            <PressableScale
              containerStyle={{ width: layout.cardWidth }}
              style={styles.card}
              scaleTo={0.98}
              haptic="tap"
              pressDelay={motion.scrollerPressDelay}
              onPress={() => playList(tracks, index)}
              accessibilityRole="button"
              accessibilityLabel={`Riproduci ${item.title} di ${item.artist}, ${SOURCE_META[item.source].label}`}
            >
              <View style={styles.stage}>
                <ArtworkAtmosphere
                  source={item.source}
                  uri={item.artworkUrl ?? item.artworkLargeUrl}
                  recyclingKey={item.uid}
                  backgroundColor={colors.surface}
                />
                <Artwork
                  source={item.source}
                  uri={item.artworkLargeUrl ?? item.artworkUrl}
                  size={layout.artworkSize}
                  radius={radius.lg}
                  priority={index === 0 ? 'high' : 'normal'}
                  recyclingKey={item.uid}
                  fade={false}
                />
              </View>
              <View style={styles.details}>
                <View style={[styles.meta, { minHeight: layout.metadataHeight }]}>
                  <Text numberOfLines={2} style={styles.title}>
                    {item.title}
                  </Text>
                  <Text numberOfLines={1} style={styles.artist}>
                    {item.artist}
                  </Text>
                  <Text numberOfLines={1} style={styles.source}>
                    {SOURCE_META[item.source].label}
                  </Text>
                </View>
                <View style={styles.play}>
                  <Ionicons name="play" size={24} color={colors.bg} />
                </View>
              </View>
            </PressableScale>
          </View>
        )}
      />
      {tracks.length > 1 ? (
        <View
          style={styles.pagination}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel="Brani in ascesa"
          accessibilityValue={{
            min: 1,
            max: tracks.length,
            now: page + 1,
            text: `Brano ${page + 1} di ${tracks.length}`,
          }}
          accessibilityLiveRegion="polite"
          accessibilityActions={[
            { name: 'increment', label: 'Scheda successiva' },
            { name: 'decrement', label: 'Scheda precedente' },
          ]}
          onAccessibilityAction={({ nativeEvent }) => {
            if (nativeEvent.actionName === 'increment') goToPage(page + 1);
            if (nativeEvent.actionName === 'decrement') goToPage(page - 1);
          }}
        >
          {tracks.map((track, index) => (
            <View
              key={track.uid}
              accessible={false}
              style={[styles.dot, index === page && styles.activeDot]}
            />
          ))}
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  section: { paddingTop: spacing.md, paddingBottom: spacing.sm },
  heading: {
    ...type.caption,
    fontWeight: '700',
    letterSpacing: 1.4,
    color: colors.textMuted,
    textTransform: 'uppercase',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  viewport: { overflow: 'hidden' },
  page: { alignItems: 'center' },
  card: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  stage: { alignItems: 'center', paddingVertical: spacing.lg },
  details: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    padding: spacing.lg,
  },
  meta: { flex: 1, gap: spacing.xs, justifyContent: 'center' },
  title: { ...type.title, fontSize: 24, lineHeight: 32, color: colors.text },
  artist: { ...type.body, lineHeight: 20, color: colors.textMuted },
  source: { ...type.caption, lineHeight: 16, color: colors.textMuted },
  play: {
    width: 52,
    height: 52,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },
  pagination: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: spacing.xs,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.textMuted,
    opacity: 0.65,
  },
  activeDot: { width: 8, height: 8, backgroundColor: colors.accent, opacity: 1 },
});

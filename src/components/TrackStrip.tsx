import { FlatList, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useQueue } from '@/hooks/useQueue';
import { colors, motion, radius, spacing, touch, type } from '@/theme';
import type { Track } from '@/types/track';
import { Artwork } from './Artwork';
import { PressableScale } from './PressableScale';
import { StripSkeleton, TrackListSkeleton } from './Skeleton';

interface Props {
  title: string;
  tracks: Track[];
  /** Sagoma al posto delle schede finche' non arriva niente. */
  loading?: boolean;
  /** Ascolti recenti compatti, con copertina e testo affiancati. */
  compact?: boolean;
  /** Collegamento a destra del titolo ("Tutti"). */
  more?: { label: string; onPress: () => void; accessibilityLabel?: string };
  /** Default: sostituisce la coda con la vetrina, partendo dalla scheda toccata. */
  onPlay?: (index: number) => void;
}

/**
 * Vetrina orizzontale di brani: recenti compatti o copertine delle voci nuove.
 * Cambia la composizione, ma coda, accessibilita' e comportamento del tocco
 * restano condivisi.
 *
 * Senza brani e senza caricamento non occupa spazio: una vetrina vuota
 * con il titolo sopra sarebbe una promessa non mantenuta.
 */
export function TrackStrip({
  title,
  tracks,
  loading = false,
  compact = false,
  more,
  onPlay,
}: Props) {
  const { width, fontScale } = useWindowDimensions();
  const { playList } = useQueue();
  const play = onPlay ?? ((index: number) => playList(tracks, index));
  const compactWidth = Math.max(164, Math.min(240, (width - 44) / 2) * Math.min(fontScale, 1.5));

  if (tracks.length === 0 && !loading) return null;

  return (
    <View style={styles.strip}>
      <View style={styles.head}>
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
        {more ? (
          <Pressable
            onPress={more.onPress}
            style={({ pressed }) => [touch.target, pressed && styles.morePressed]}
            accessibilityRole="button"
            accessibilityLabel={more.accessibilityLabel ?? more.label}
          >
            <Text style={styles.more}>{more.label}</Text>
          </Pressable>
        ) : null}
      </View>

      {tracks.length === 0 ? (
        compact ? (
          <TrackListSkeleton rows={1} />
        ) : (
          <StripSkeleton size={148} />
        )
      ) : (
        <FlatList
          horizontal
          data={tracks}
          keyExtractor={(t) => t.uid}
          // Lista annidata: senza questa proprieta' il primo tocco con la
          // tastiera aperta la chiude e basta, e l'artista non si apre.
          keyboardShouldPersistTaps="handled"
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.list}
          renderItem={({ item, index }) => (
            <PressableScale
              containerStyle={{ width: compact ? compactWidth : 148 }}
              style={[styles.card, compact && styles.compactCard]}
              haptic="tap"
              pressDelay={motion.scrollerPressDelay}
              onPress={() => play(index)}
              accessibilityRole="button"
              accessibilityLabel={`Riproduci ${item.title} di ${item.artist}`}
            >
              <Artwork
                source={item.source}
                uri={item.artworkUrl}
                size={compact ? 44 : 148}
                radius={compact ? radius.md : radius.lg}
                recyclingKey={item.uid}
                fade={false}
              />
              <View style={compact ? styles.compactMeta : styles.meta}>
                <Text numberOfLines={2} style={styles.cardTitle}>
                  {item.title}
                </Text>
                <Text numberOfLines={1} style={styles.cardArtist}>
                  {item.artist}
                </Text>
              </View>
            </PressableScale>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: { paddingTop: spacing.sm, paddingBottom: spacing.sm },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: spacing.lg,
  },
  title: {
    ...type.title,
    flexShrink: 1,
    color: colors.text,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  more: { ...type.caption, color: colors.accent },
  morePressed: { opacity: 0.5 },
  list: { paddingHorizontal: spacing.lg, gap: spacing.md },
  card: { gap: spacing.sm },
  compactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    minHeight: 64,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  meta: { gap: spacing.xs },
  compactMeta: { flex: 1, gap: spacing.xs },
  cardTitle: { ...type.label, color: colors.text, fontSize: 13 },
  cardArtist: { ...type.caption, color: colors.textMuted },
});

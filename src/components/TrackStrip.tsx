import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useQueue } from '@/hooks/useQueue';
import { colors, motion, radius, spacing, type } from '@/theme';
import type { Track } from '@/types/track';
import { Artwork } from './Artwork';
import { PressableScale } from './PressableScale';
import { StripSkeleton } from './Skeleton';

interface Props {
  title: string;
  tracks: Track[];
  /** Sagoma al posto delle schede finche' non arriva niente. */
  loading?: boolean;
  /** Collegamento a destra del titolo ("Tutti"). */
  more?: { label: string; onPress: () => void; accessibilityLabel?: string };
  /** Default: sostituisce la coda con la vetrina, partendo dalla scheda toccata. */
  onPlay?: (index: number) => void;
}

/**
 * Vetrina orizzontale di brani: ascolti recenti, in ascesa, voci nuove.
 * Una sola, cosi' le schede di Scopri sono identiche fra loro e ogni
 * sezione nuova costa un titolo e una query.
 *
 * Senza brani e senza caricamento non occupa spazio: una vetrina vuota
 * con il titolo sopra sarebbe una promessa non mantenuta.
 */
export function TrackStrip({ title, tracks, loading = false, more, onPlay }: Props) {
  const { playList } = useQueue();
  const play = onPlay ?? ((index: number) => playList(tracks, index));

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
            hitSlop={10}
            style={({ pressed }) => pressed && styles.morePressed}
            accessibilityRole="button"
            accessibilityLabel={more.accessibilityLabel ?? more.label}
          >
            <Text style={styles.more}>{more.label}</Text>
          </Pressable>
        ) : null}
      </View>

      {tracks.length === 0 ? (
        <StripSkeleton />
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
              style={styles.card}
              haptic="tap"
              pressDelay={motion.scrollerPressDelay}
              onPress={() => play(index)}
              accessibilityRole="button"
              accessibilityLabel={`Riproduci ${item.title} di ${item.artist}`}
            >
              <Artwork
                uri={item.artworkUrl}
                size={128}
                radius={radius.md}
                recyclingKey={item.uid}
                fade={false}
              />
              <Text numberOfLines={2} style={styles.cardTitle}>
                {item.title}
              </Text>
              <Text numberOfLines={1} style={styles.cardArtist}>
                {item.artist}
              </Text>
            </PressableScale>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: { paddingBottom: spacing.sm },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: spacing.lg,
  },
  title: {
    ...type.title,
    color: colors.text,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  more: { ...type.caption, color: colors.accent },
  morePressed: { opacity: 0.5 },
  list: { paddingHorizontal: spacing.lg, gap: spacing.md },
  card: { width: 128, gap: 4 },
  cardTitle: { ...type.caption, color: colors.text, fontSize: 13 },
  cardArtist: { ...type.caption, color: colors.textMuted },
});

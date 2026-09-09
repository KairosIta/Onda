import { FlatList, StyleSheet, Text, View } from 'react-native';
import { colors, motion, radius, spacing, type } from '@/theme';
import type { SourceId } from '@/types/track';
import { Artwork } from './Artwork';
import { PressableScale } from './PressableScale';
import { StripSkeleton } from './Skeleton';

export interface Entity {
  key: string;
  title: string;
  subtitle?: string;
  imageUrl?: string;
  source: SourceId;
  onPress: () => void;
}

interface Props {
  title: string;
  items: Entity[];
  /** Tondo per gli artisti, quadrato per gli album. */
  shape: 'circle' | 'square';
  loading?: boolean;
}

const SIZE = 96;

/**
 * Vetrina di artisti o album nei risultati di ricerca. Ogni scheda apre
 * una pagina, non un brano: per questo la sigla della sorgente e' sempre
 * visibile, come nelle righe.
 */
export function EntityStrip({ title, items, shape, loading = false }: Props) {
  if (items.length === 0 && !loading) return null;

  return (
    <View style={styles.strip}>
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      {items.length === 0 ? (
        <StripSkeleton cards={4} size={SIZE} round={shape === 'circle'} />
      ) : (
        <FlatList
          horizontal
          data={items}
          keyExtractor={(e) => e.key}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <PressableScale
              style={[styles.card, shape === 'circle' && styles.cardCentered]}
              haptic="tap"
              pressDelay={motion.scrollerPressDelay}
              onPress={item.onPress}
              accessibilityRole="button"
              accessibilityLabel={`${item.title}, ${item.source === 'audius' ? 'Audius' : 'Jamendo'}`}
            >
              <Artwork
                uri={item.imageUrl}
                size={SIZE}
                radius={shape === 'circle' ? radius.pill : radius.md}
                recyclingKey={item.key}
                fade={false}
              />
              <Text
                numberOfLines={2}
                style={[styles.cardTitle, shape === 'circle' && styles.textCentered]}
              >
                {item.title}
              </Text>
              <Text
                numberOfLines={1}
                style={[styles.cardSubtitle, shape === 'circle' && styles.textCentered]}
              >
                {item.subtitle ? `${item.subtitle} · ` : ''}
                {item.source === 'audius' ? 'AUD' : 'JAM'}
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
  title: {
    ...type.title,
    color: colors.text,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  list: { paddingHorizontal: spacing.lg, gap: spacing.md },
  card: { width: SIZE, gap: 4 },
  cardCentered: { alignItems: 'center' },
  cardTitle: { ...type.caption, color: colors.text, fontSize: 13 },
  cardSubtitle: { ...type.caption, color: colors.textMuted },
  textCentered: { textAlign: 'center' },
});

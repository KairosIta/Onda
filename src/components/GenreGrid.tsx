import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { GENRES } from '@/services/genres';
import { colors, motion, radius, spacing, type } from '@/theme';
import { PressableScale } from './PressableScale';

/**
 * I generi come griglia a due colonne, ognuno con la sua pagina. Prima
 * erano chip che filtravano la lista sul posto: funzionava, ma sedici chip
 * in una riga da scorrere sono un menu, non una home.
 */
export function GenreGrid() {
  const router = useRouter();

  return (
    <View>
      <Text style={styles.title} accessibilityRole="header">
        Generi
      </Text>
      <View style={styles.grid}>
        {GENRES.map((g) => (
          <PressableScale
            key={g.key}
            containerStyle={styles.cell}
            style={styles.card}
            haptic="tap"
            pressDelay={motion.scrollerPressDelay}
            onPress={() => router.push({ pathname: '/genre/[key]', params: { key: g.key } })}
            accessibilityRole="button"
            accessibilityLabel={`Genere ${g.label}`}
          >
            <Text numberOfLines={1} style={styles.label}>
              {g.label}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </PressableScale>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    ...type.title,
    color: colors.text,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  // Due colonne con un po' d'aria in mezzo: 48% + 48% lascia il 4% di spazio.
  cell: { width: '48%' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 52,
    paddingLeft: spacing.md,
    paddingRight: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  label: { ...type.label, color: colors.text, flex: 1 },
});

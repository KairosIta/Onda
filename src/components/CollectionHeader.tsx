import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PressableScale } from '@/components/PressableScale';
import { colors, motion, radius, spacing, touch, type } from '@/theme';

interface Props {
  title: string;
  subtitle?: string;
  /** Disabilita i due bottoni quando la raccolta e' vuota. */
  count: number;
  onPlay: () => void;
  onShuffle: () => void;
  /** Bottoni extra a destra del titolo (rinomina, svuota, ...). */
  actions?: ReactNode;
  /**
   * Copertina o avatar. Va qui e non sopra l'intestazione: messa prima,
   * spingerebbe il pulsante Indietro sotto l'immagine, dove nessuno lo
   * cerca.
   */
  media?: ReactNode;
}

/** Intestazione comune a preferiti, cronologia, playlist, artista e album. */
export function CollectionHeader({
  title,
  subtitle,
  count,
  onPlay,
  onShuffle,
  actions,
  media,
}: Props) {
  const router = useRouter();
  const off = count === 0;

  return (
    <View style={styles.wrap}>
      <View style={styles.topRow}>
        <PressableScale
          onPress={() => router.back()}
          containerStyle={touch.target}
          scaleTo={motion.iconPressScale}
          accessibilityRole="button"
          accessibilityLabel="Indietro"
        >
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </PressableScale>
        <View style={styles.actions}>{actions}</View>
      </View>

      {media}

      <Text numberOfLines={2} style={styles.title}>
        {title}
      </Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}

      {/* L'opacita' da spento sta sul contenitore che si anima, cosi' il
          bottone resta un pezzo solo anche mentre si ritrae. */}
      <View style={styles.buttons}>
        <PressableScale
          style={[styles.primary, off && styles.off]}
          haptic="tap"
          disabled={off}
          onPress={onPlay}
          accessibilityRole="button"
          accessibilityLabel="Riproduci tutto"
        >
          <Ionicons name="play" size={18} color={colors.bg} />
          <Text style={styles.primaryText}>Riproduci</Text>
        </PressableScale>

        <PressableScale
          style={[styles.secondary, off && styles.off]}
          haptic="tap"
          disabled={off}
          onPress={onShuffle}
          accessibilityRole="button"
          accessibilityLabel="Riproduci in ordine casuale"
        >
          <Ionicons name="shuffle" size={18} color={colors.text} />
          <Text style={styles.secondaryText}>Casuale</Text>
        </PressableScale>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.xs,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 32,
  },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  title: { ...type.display, color: colors.text, marginTop: spacing.sm },
  subtitle: { ...type.caption, color: colors.textMuted },
  buttons: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  primary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.pill,
  },
  primaryText: { ...type.label, color: colors.bg },
  secondary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceHigh,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.pill,
  },
  secondaryText: { ...type.label, color: colors.text },
  off: { opacity: 0.35 },
});

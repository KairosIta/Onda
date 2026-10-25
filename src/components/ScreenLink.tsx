import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, type } from '@/theme';
import { PressableScale } from './PressableScale';

/**
 * La riga gemella di `ExternalLink` per una schermata di Onda: stessa forma
 * e stesso feedback, ma la freccia dice che si resta nell'app e il ruolo e'
 * un bottone, non un link che apre il browser.
 */
export function ScreenLink({
  label,
  detail,
  onPress,
}: {
  label: string;
  /** Una riga sotto l'etichetta, per dire cosa si trova. */
  detail?: string;
  onPress: () => void;
}) {
  return (
    <PressableScale
      onPress={onPress}
      style={styles.link}
      pressedStyle={styles.pressed}
      scaleTo={0.98}
      accessibilityRole="button"
      accessibilityLabel={detail ? `${label}, ${detail}` : label}
    >
      <View style={styles.meta}>
        <Text style={styles.linkText}>{label}</Text>
        {detail ? <Text style={styles.detail}>{detail}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  link: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceHigh,
  },
  pressed: { opacity: 0.65 },
  meta: { flex: 1, gap: 2 },
  linkText: { ...type.body, color: colors.text },
  detail: { ...type.caption, color: colors.textMuted },
});

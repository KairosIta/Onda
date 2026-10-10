import { Ionicons } from '@expo/vector-icons';
import { Linking, StyleSheet, Text } from 'react-native';
import { colors, radius, spacing, type } from '@/theme';
import { PressableScale } from './PressableScale';

/**
 * Riga larga quanto la scheda: si ritrae appena, perche' su una
 * superficie cosi' estesa la scala da bottone sembrerebbe un salto. Il 2%
 * da solo pero' non si vede, e con "Rimuovi animazioni" nemmeno si muove:
 * resta anche l'opacita' da premuto.
 */
export function ExternalLink({ label, url }: { label: string; url: string }) {
  return (
    <PressableScale
      onPress={() => Linking.openURL(url)}
      style={styles.link}
      pressedStyle={styles.pressed}
      scaleTo={0.98}
      accessibilityRole="link"
      accessibilityLabel={`${label}, apre il browser`}
    >
      <Text style={styles.linkText}>{label}</Text>
      <Ionicons name="open-outline" size={18} color={colors.textMuted} />
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
    borderRadius: radius.md,
    backgroundColor: colors.surfaceHigh,
  },
  pressed: { opacity: 0.65 },
  linkText: { ...type.body, flex: 1, color: colors.text },
});

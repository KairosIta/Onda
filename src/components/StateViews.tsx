import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, type } from '@/theme';
import { PressableScale } from './PressableScale';

export function Loading() {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.accent} />
    </View>
  );
}

/**
 * Uno schermo vuoto e' un invito ad agire, non un vicolo cieco.
 *
 * `action` serve ai vuoti che non sono vuoti davvero: quando le sorgenti
 * non rispondono l'elenco non riparte da solo, e senza un bottone l'unica
 * via d'uscita sarebbe cambiare schermata e tornare indietro.
 *
 * La pressione e' resa dalla scala del bottone; l'opacita' ridotta dice
 * solo "sto gia' riprovando", cosi' i due stati non si confondono.
 */
export function Empty({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: { label: string; onPress: () => void; busy?: boolean };
}) {
  return (
    <View style={styles.center}>
      <Text style={styles.title}>{title}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      {action ? (
        <PressableScale
          onPress={action.onPress}
          disabled={action.busy}
          haptic="tap"
          containerStyle={styles.actionSlot}
          style={[styles.action, action.busy && styles.actionOff]}
          accessibilityRole="button"
          accessibilityState={{ disabled: action.busy, busy: action.busy }}
        >
          {action.busy ? <ActivityIndicator size="small" color={colors.text} /> : null}
          <Text style={styles.actionText}>{action.label}</Text>
        </PressableScale>
      ) : null}
    </View>
  );
}

/** Dice cosa e' andato storto e cosa fare, non "ops qualcosa e' andato storto". */
export function ErrorNotice({ message }: { message: string }) {
  return (
    <View style={styles.notice}>
      <Text style={styles.noticeText}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
  },
  title: { ...type.body, color: colors.text, textAlign: 'center' },
  hint: { ...type.caption, color: colors.textMuted, textAlign: 'center' },
  actionSlot: { marginTop: spacing.md },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceHigh,
  },
  actionOff: { opacity: 0.5 },
  actionText: { ...type.label, color: colors.text },
  notice: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: 8,
    backgroundColor: colors.surfaceHigh,
    borderLeftWidth: 2,
    borderLeftColor: colors.danger,
  },
  noticeText: { ...type.caption, color: colors.textMuted },
});

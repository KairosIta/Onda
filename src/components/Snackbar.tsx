import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown, ReduceMotion } from 'react-native-reanimated';
import { colors, radius, spacing, type } from '@/theme';
import { PressableScale } from './PressableScale';

export interface Snack {
  message: string;
  action?: { label: string; onPress: () => void };
}

interface Props {
  snack: Snack | null;
  onDismiss: () => void;
  /** Quattro secondi: abbastanza per leggere e decidere, non per dimenticarsene. */
  durationMs?: number;
  /** Spazio da lasciare sotto, per la barra di navigazione. */
  bottom?: number;
}

const ENTERING = FadeInDown.duration(200).reduceMotion(ReduceMotion.System);
const EXITING = FadeOutDown.duration(160).reduceMotion(ReduceMotion.System);

/**
 * Avviso in basso con un'azione, al posto di un toast che sparisce prima
 * di essere letto. Il genitore lo tiene montato dentro una View sua: il
 * `return null` toglie solo il contenuto e l'uscita ha il tempo di finire.
 */
export function Snackbar({ snack, onDismiss, durationMs = 4000, bottom = 0 }: Props) {
  useEffect(() => {
    if (!snack) return;
    const handle = setTimeout(onDismiss, durationMs);
    return () => clearTimeout(handle);
  }, [snack, durationMs, onDismiss]);

  if (!snack) return null;

  return (
    <Animated.View
      style={[styles.wrap, { bottom: bottom + spacing.lg }]}
      entering={ENTERING}
      exiting={EXITING}
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
    >
      <Text style={styles.message} numberOfLines={2}>
        {snack.message}
      </Text>
      {snack.action ? (
        <PressableScale
          onPress={() => {
            snack.action?.onPress();
            onDismiss();
          }}
          haptic="tap"
          hitSlop={8}
          style={styles.action}
          accessibilityRole="button"
        >
          <Text style={styles.actionText}>{snack.action.label}</Text>
        </PressableScale>
      ) : null}
      <View />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingLeft: spacing.lg,
    paddingRight: spacing.sm,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: colors.border,
    elevation: 6,
  },
  message: { ...type.body, color: colors.text, flex: 1 },
  action: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
  },
  actionText: { ...type.label, color: colors.accent },
});

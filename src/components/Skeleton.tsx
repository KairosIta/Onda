import { useEffect } from 'react';
import {
  StyleSheet,
  View,
  type DimensionValue,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { colors, radius, spacing } from '@/theme';

/**
 * Sagome che respirano al posto della rotella.
 *
 * Una rotella al centro dice "aspetta" e basta; la sagoma della lista
 * dice anche cosa sta per arrivare e dove, e quando i dati entrano non
 * c'e' il salto da schermata vuota a schermata piena. Un solo valore
 * animato per tutta la sagoma, non uno per riga: le righe pulsano
 * insieme e il thread UI fa un lavoro solo. Con "Rimuovi animazioni"
 * attivo la sagoma resta ferma.
 *
 * Le sagome sono invisibili a TalkBack: non c'e' niente da leggere, e
 * una lista di "elemento, elemento, elemento" sarebbe solo rumore.
 */
function usePulse() {
  const reduced = useReducedMotion();
  const opacity = useSharedValue(reduced ? 0.7 : 0.45);

  useEffect(() => {
    if (reduced) return;
    opacity.set(
      withRepeat(withTiming(0.9, { duration: 900, easing: Easing.inOut(Easing.ease) }), -1, true),
    );
    return () => cancelAnimation(opacity);
  }, [opacity, reduced]);

  return useAnimatedStyle(() => ({ opacity: opacity.get() }));
}

function Bone({
  w,
  h,
  r = radius.sm,
  style,
}: {
  w: DimensionValue;
  h: number;
  r?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.bone, { width: w, height: h, borderRadius: r }, style]} />;
}

function Rows({ rows }: { rows: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} style={styles.row}>
          <Bone w={48} h={48} />
          <View style={styles.meta}>
            <Bone w={`${64 - (i % 3) * 9}%`} h={14} />
            <Bone w={`${36 + (i % 2) * 12}%`} h={11} />
          </View>
          <Bone w={30} h={11} />
        </View>
      ))}
    </>
  );
}

const hidden = {
  accessibilityElementsHidden: true,
  importantForAccessibility: 'no-hide-descendants',
} as const;

/** Sagoma di una lista di brani, larga quanto `TrackRow`. */
export function TrackListSkeleton({ rows = 8 }: { rows?: number }) {
  const pulse = usePulse();
  return (
    <Animated.View style={pulse} {...hidden}>
      <Rows rows={rows} />
    </Animated.View>
  );
}

/**
 * Sagoma di una raccolta: copertina o avatar, titolo, due bottoni, righe.
 * `circle` per gli artisti, `square` per gli album.
 */
export function CollectionSkeleton({
  media = 'square',
  rows = 6,
}: {
  media?: 'circle' | 'square' | 'none';
  rows?: number;
}) {
  const pulse = usePulse();
  return (
    <Animated.View style={pulse} {...hidden}>
      <View style={styles.head}>
        {media === 'circle' ? <Bone w={132} h={132} r={radius.pill} style={styles.media} /> : null}
        {media === 'square' ? <Bone w={180} h={180} r={radius.md} style={styles.media} /> : null}
        <Bone w="58%" h={24} />
        <Bone w="34%" h={12} />
        <View style={styles.buttons}>
          <Bone w={118} h={36} r={radius.pill} />
          <Bone w={106} h={36} r={radius.pill} />
        </View>
      </View>
      <Rows rows={rows} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bone: { backgroundColor: colors.surfaceHigh },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  meta: { flex: 1, gap: 8 },
  head: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    gap: 10,
  },
  media: { alignSelf: 'center', marginTop: spacing.xl, marginBottom: spacing.sm },
  buttons: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
});

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
 * Per TalkBack la sagoma e' un solo elemento, "Caricamento in corso",
 * come lo era la rotella: le ossa sotto restano nascoste, perche' una
 * lista di "elemento, elemento, elemento" sarebbe solo rumore, ma il
 * caricamento deve essere annunciato, altrimenti chi non vede passa dal
 * niente alla lista piena senza sapere se l'app sta lavorando.
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

/** La radice e' l'unico nodo che TalkBack vede: un indicatore di avanzamento. */
const progress = {
  accessible: true,
  accessibilityRole: 'progressbar',
  accessibilityLabel: 'Caricamento in corso',
  accessibilityState: { busy: true },
  accessibilityLiveRegion: 'polite',
} as const;

/** Le ossa non hanno niente da dire: nascoste con tutti i discendenti. */
const hidden = {
  accessibilityElementsHidden: true,
  importantForAccessibility: 'no-hide-descendants',
} as const;

/** Sagoma di una lista di brani, larga quanto `TrackRow`. */
export function TrackListSkeleton({ rows = 8 }: { rows?: number }) {
  const pulse = usePulse();
  return (
    <Animated.View style={pulse} {...progress}>
      <View {...hidden}>
        <Rows rows={rows} />
      </View>
    </Animated.View>
  );
}

/**
 * Sagoma di una raccolta: copertina o avatar, titolo, due bottoni, righe.
 * `circle` per gli artisti, `square` per gli album.
 *
 * La geometria ricalca `CollectionHeader` pezzo per pezzo (riga del
 * chevron, spazio sopra il media, altezza di riga del titolo, bottoni),
 * altrimenti all'arrivo dei dati avatar e righe scenderebbero di quasi
 * una riga: il salto che la sagoma esiste per evitare.
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
    <Animated.View style={pulse} {...progress}>
      <View {...hidden}>
        <View style={styles.head}>
          <View style={styles.topRow}>
            <Bone w={26} h={26} r={radius.pill} />
          </View>
          {media === 'circle' ? (
            <View style={styles.mediaWrap}>
              <Bone w={132} h={132} r={radius.pill} />
            </View>
          ) : null}
          {media === 'square' ? (
            <View style={styles.mediaWrap}>
              <Bone w={180} h={180} r={radius.md} />
            </View>
          ) : null}
          <View style={styles.titleLine}>
            <Bone w="58%" h={22} />
          </View>
          <View style={styles.subtitleLine}>
            <Bone w="34%" h={12} />
          </View>
          <View style={styles.buttons}>
            <Bone w={118} h={40} r={radius.pill} />
            <Bone w={106} h={40} r={radius.pill} />
          </View>
        </View>
        <Rows rows={rows} />
      </View>
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
  // Stessi padding e gap di `CollectionHeader.wrap`.
  head: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.xs,
  },
  // `CollectionHeader.topRow`: minHeight 32.
  topRow: { minHeight: 32, justifyContent: 'center' },
  // `avatarWrap`/`coverWrap` delle schermate: paddingTop 24.
  mediaWrap: { alignItems: 'center', paddingTop: spacing.xl },
  // Riga di `type.display` (28dp, ~38 di riga) con il suo marginTop 8.
  titleLine: { height: 38, justifyContent: 'center', marginTop: spacing.sm },
  // Riga di `type.caption` (12dp, ~16 di riga).
  subtitleLine: { height: 16, justifyContent: 'center' },
  // Bottoni pieni: padding 10 + riga di `type.label` ~20 = 40, marginTop 12.
  buttons: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
});

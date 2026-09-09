import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { memo, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  FadeOutDown,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import TrackPlayer, { useActiveMediaItem, useIsPlaying, useProgress } from '@rntp/player';
import { colors, motion, spacing, type } from '@/theme';
import { Artwork } from './Artwork';
import { PressableScale } from './PressableScale';

const ENTERING = FadeInDown.duration(220).reduceMotion(ReduceMotion.System);
const EXITING = FadeOutDown.duration(160).reduceMotion(ReduceMotion.System);

/**
 * `useProgress(0.5)` da' un valore ogni mezzo secondo: la barra insegue il
 * nuovo valore in altrettanto tempo, lineare, cosi' i tick non si vedono
 * come scatti ma come un movimento continuo.
 */
const TIMING = { duration: 500, easing: Easing.linear, reduceMotion: ReduceMotion.System };

/**
 * La barra di avanzamento vive in un figlio memoizzato: `useProgress` fa
 * un setState ogni mezzo secondo, e cosi' il tick ridisegna solo questa
 * View da 2dp, non copertina e bottoni del mini-player (che possono
 * essere due, tab bar e `Screen`).
 */
const MiniProgress = memo(function MiniProgress() {
  const { position, duration } = useProgress(0.5);
  const pct = duration > 0 ? Math.min(1, position / duration) : 0;
  const progress = useSharedValue(pct);
  // Ultimo valore inviato. Il confronto si fa su questo e non su
  // `progress.get()`: dal thread JS quella e' una lettura sincrona verso
  // il thread UI, un costo inutile due volte al secondo.
  const last = useRef(pct);

  useEffect(() => {
    // Indietro (seek, cambio brano) si salta: una barra che si ritira in
    // mezzo secondo racconterebbe un riavvolgimento che non c'e'.
    if (pct < last.current) progress.set(pct);
    else progress.set(withTiming(pct, TIMING));
    last.current = pct;
  }, [pct, progress]);

  // Scala e non larghezza: la trasformazione resta sul thread UI senza
  // rifare il layout a ogni frame, e con l'origine a sinistra non serve
  // conoscere la larghezza della barra.
  const fill = useAnimatedStyle(() => ({ transform: [{ scaleX: progress.get() }] }));

  return (
    <View style={styles.progressTrack}>
      <Animated.View style={[styles.progressFill, fill]} />
    </View>
  );
});

/**
 * Vive nella tab bar custom di (tabs)/_layout.tsx e dentro `Screen` per le
 * schermate spinte sullo Stack. In entrambi i casi il genitore e' una View
 * che resta montata: il `return null` di quando non c'e' traccia toglie
 * solo il contenuto, e l'animazione di uscita ha il tempo di finire.
 *
 * L'ingresso si anima solo quando una traccia compare, non quando una
 * schermata si monta con un brano gia' in corso: li' il mini-player e'
 * parte della schermata che arriva, e farlo salire da sotto mentre lo
 * Stack scorre sarebbe un secondo movimento senza significato.
 */
export function MiniPlayer() {
  const router = useRouter();
  const track = useActiveMediaItem();
  const playing = useIsPlaying();

  // Stato derivato nel render: si arma quando la traccia manca, cosi' la
  // prossima che arriva entra animata. Montato con un brano in corso
  // resta disarmato finche' il brano non finisce.
  const [enterArmed, setEnterArmed] = useState(!track);
  if (!track && !enterArmed) setEnterArmed(true);

  if (!track) return null;

  return (
    <Animated.View
      style={styles.wrap}
      entering={enterArmed ? ENTERING : undefined}
      exiting={EXITING}
    >
      <MiniProgress />

      {/* Apre una schermata: evidenziazione come le righe di lista, non
          scala, cosi' un bersaglio largo non sembra un bottone. */}
      <Pressable
        style={({ pressed }) => [styles.body, pressed && styles.bodyPressed]}
        onPress={() => router.push('/player')}
        accessibilityRole="button"
        accessibilityLabel={`Apri il player: ${track.title} di ${track.artist}`}
      >
        <Artwork
          uri={typeof track.artworkUrl === 'string' ? track.artworkUrl : undefined}
          size={40}
          recyclingKey={String(track.mediaId ?? '')}
        />

        <View style={styles.meta}>
          <Text numberOfLines={1} style={styles.title}>
            {track.title}
          </Text>
          <Text numberOfLines={1} style={styles.artist}>
            {track.artist}
          </Text>
        </View>

        <PressableScale
          scaleTo={motion.iconPressScale}
          haptic="tap"
          hitSlop={12}
          onPress={() => (playing ? TrackPlayer.pause() : TrackPlayer.play())}
          accessibilityRole="button"
          accessibilityLabel={playing ? 'Metti in pausa' : 'Riprendi'}
        >
          <Ionicons name={playing ? 'pause' : 'play'} size={26} color={colors.text} />
        </PressableScale>

        <PressableScale
          scaleTo={motion.iconPressScale}
          haptic="tap"
          hitSlop={12}
          onPress={() => TrackPlayer.skipToNext()}
          accessibilityRole="button"
          accessibilityLabel="Traccia successiva"
        >
          <Ionicons name="play-skip-forward" size={22} color={colors.textMuted} />
        </PressableScale>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  progressTrack: { height: 2, backgroundColor: colors.accentDim },
  progressFill: {
    height: 2,
    width: '100%',
    backgroundColor: colors.accent,
    transformOrigin: 'left',
  },
  body: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  bodyPressed: { backgroundColor: colors.surfaceHigh },
  meta: { flex: 1, gap: 1 },
  title: { ...type.body, color: colors.text },
  artist: { ...type.caption, color: colors.textMuted },
});

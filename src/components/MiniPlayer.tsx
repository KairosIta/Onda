import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import TrackPlayer, { useActiveMediaItem, useIsPlaying, useProgress } from '@rntp/player';
import { colors, spacing, radius, type } from '@/theme';

/**
 * Montato nel layout radice, FUORI dallo Stack: cosi' non viene smontato
 * quando cambi schermata e la riproduzione resta continua.
 */
export function MiniPlayer() {
  const router = useRouter();
  const track = useActiveMediaItem();
  const playing = useIsPlaying();
  const { position, duration } = useProgress(0.5);

  if (!track) return null;

  const pct = duration > 0 ? Math.min(100, (position / duration) * 100) : 0;

  return (
    <View style={styles.wrap}>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${pct}%` }]} />
      </View>

      <Pressable style={styles.body} onPress={() => router.push('/player')}>
        {track.artworkUrl ? (
          <Image source={{ uri: String(track.artworkUrl) }} style={styles.art} />
        ) : (
          <View style={[styles.art, styles.artEmpty]} />
        )}

        <View style={styles.meta}>
          <Text numberOfLines={1} style={styles.title}>
            {track.title}
          </Text>
          <Text numberOfLines={1} style={styles.artist}>
            {track.artist}
          </Text>
        </View>

        <Pressable
          hitSlop={12}
          onPress={() => (playing ? TrackPlayer.pause() : TrackPlayer.play())}
          accessibilityLabel={playing ? 'Metti in pausa' : 'Riprendi'}
        >
          <Ionicons name={playing ? 'pause' : 'play'} size={26} color={colors.text} />
        </Pressable>

        <Pressable
          hitSlop={12}
          onPress={() => TrackPlayer.skipToNext()}
          accessibilityLabel="Traccia successiva"
        >
          <Ionicons name="play-skip-forward" size={22} color={colors.textMuted} />
        </Pressable>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  progressTrack: { height: 2, backgroundColor: colors.accentDim },
  progressFill: { height: 2, backgroundColor: colors.accent },
  body: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  art: { width: 40, height: 40, borderRadius: radius.sm, backgroundColor: colors.surfaceHigh },
  artEmpty: { borderWidth: 1, borderColor: colors.border },
  meta: { flex: 1, gap: 1 },
  title: { ...type.body, color: colors.text },
  artist: { ...type.caption, color: colors.textMuted },
});

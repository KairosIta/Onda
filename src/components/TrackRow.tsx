import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, formatTime, radius, spacing, type } from '@/theme';
import type { Track } from '@/types/track';

interface Props {
  track: Track;
  index: number;
  isActive?: boolean;
  isFavorite?: boolean;
  onPress: (track: Track, index: number) => void;
  /** Apre il menu contestuale. Ci arriva anche il long press. */
  onMore?: (track: Track) => void;
}

/**
 * Riga volutamente muta: non si abbona a nessuno store. "Preferito" e
 * "in riproduzione" arrivano come prop dalla lista, che si abbona una
 * volta sola. Altrimenti ogni cuoricino toccato ridisegnerebbe l'intera
 * schermata riga per riga.
 */
export const TrackRow = memo(function TrackRow({
  track,
  index,
  isActive = false,
  isFavorite = false,
  onPress,
  onMore,
}: Props) {
  return (
    <Pressable
      onPress={() => onPress(track, index)}
      onLongPress={onMore ? () => onMore(track) : undefined}
      delayLongPress={300}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`Riproduci ${track.title} di ${track.artist}`}
    >
      {track.artworkUrl ? (
        <Image source={{ uri: track.artworkUrl }} style={styles.art} />
      ) : (
        <View style={[styles.art, styles.artEmpty]} />
      )}

      <View style={styles.meta}>
        <Text numberOfLines={1} style={[styles.title, isActive && styles.titleActive]}>
          {track.title}
        </Text>
        <Text numberOfLines={1} style={styles.artist}>
          {track.artist}
        </Text>
      </View>

      <View style={styles.right}>
        <Text style={styles.source}>{track.source === 'audius' ? 'AUD' : 'JAM'}</Text>
        <View style={styles.rightBottom}>
          {isFavorite ? <Ionicons name="heart" size={11} color={colors.accent} /> : null}
          <Text style={styles.duration}>{formatTime(track.durationSec)}</Text>
        </View>
      </View>

      {onMore ? (
        <Pressable
          onPress={() => onMore(track)}
          hitSlop={10}
          accessibilityLabel={`Opzioni per ${track.title}`}
        >
          <Ionicons name="ellipsis-horizontal" size={18} color={colors.textMuted} />
        </Pressable>
      ) : null}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  pressed: { backgroundColor: colors.surface },
  art: { width: 48, height: 48, borderRadius: radius.sm, backgroundColor: colors.surfaceHigh },
  artEmpty: { borderWidth: 1, borderColor: colors.border },
  meta: { flex: 1, gap: 2 },
  title: { ...type.body, color: colors.text },
  titleActive: { color: colors.accent },
  artist: { ...type.caption, color: colors.textMuted },
  right: { alignItems: 'flex-end', gap: 2 },
  rightBottom: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  source: { ...type.caption, color: colors.textMuted, opacity: 0.6, fontSize: 10 },
  duration: { ...type.caption, color: colors.textMuted },
});

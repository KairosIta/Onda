import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { haptics } from '@/services/haptics';
import { colors, formatTime, spacing, type } from '@/theme';
import type { Track } from '@/types/track';
import { Artwork } from './Artwork';

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
 *
 * Resta un Pressable con l'evidenziazione di sfondo, non si ritrae: e'
 * la convenzione Android per le righe di lista. Il tocco vibra prima
 * che il brano parta, perche' il feedback deve arrivare col dito, non
 * col buffering.
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
      onPress={() => {
        haptics.tap();
        onPress(track, index);
      }}
      onLongPress={
        onMore
          ? () => {
              haptics.longPress();
              onMore(track);
            }
          : undefined
      }
      delayLongPress={300}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`Riproduci ${track.title} di ${track.artist}`}
    >
      <Artwork uri={track.artworkUrl} size={48} recyclingKey={track.uid} fade={false} />

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

      {/* Icona dentro una riga: segue la convenzione della riga (evidenziazione,
          qui in opacita') e non quella dei bottoni; una molla per riga
          sarebbe un valore animato in piu' per ogni riga a schermo. */}
      {onMore ? (
        <Pressable
          onPress={() => onMore(track)}
          hitSlop={10}
          style={({ pressed }) => pressed && styles.iconPressed}
          accessibilityRole="button"
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
  iconPressed: { opacity: 0.5 },
  meta: { flex: 1, gap: 2 },
  title: { ...type.body, color: colors.text },
  titleActive: { color: colors.accent },
  artist: { ...type.caption, color: colors.textMuted },
  right: { alignItems: 'flex-end', gap: 2 },
  rightBottom: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  source: { ...type.caption, color: colors.textMuted, opacity: 0.6, fontSize: 10 },
  duration: {
    ...type.caption,
    ...type.tabular,
    color: colors.textMuted,
  },
});

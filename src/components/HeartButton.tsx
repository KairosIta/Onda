import { Ionicons } from '@expo/vector-icons';
import { Pressable } from 'react-native';
import { toggleFavorite, useLibrary } from '@/store/library';
import { colors } from '@/theme';
import type { Track } from '@/types/track';

interface Props {
  track: Track;
  size?: number;
}

export function HeartButton({ track, size = 22 }: Props) {
  const { favorites } = useLibrary();
  const on = favorites.includes(track.uid);

  return (
    <Pressable
      hitSlop={12}
      onPress={() => toggleFavorite(track)}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      accessibilityLabel={on ? 'Togli dai preferiti' : 'Aggiungi ai preferiti'}
    >
      <Ionicons
        name={on ? 'heart' : 'heart-outline'}
        size={size}
        color={on ? colors.accent : colors.textMuted}
      />
    </Pressable>
  );
}

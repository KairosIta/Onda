import { Ionicons } from '@expo/vector-icons';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from 'react-native-reanimated';
import { PressableScale } from '@/components/PressableScale';
import { haptics } from '@/services/haptics';
import { toggleFavorite, useLibrary } from '@/store/library';
import { colors, motion, touch } from '@/theme';
import type { Track } from '@/types/track';

interface Props {
  track: Track;
  size?: number;
}

/** La stessa molla dei bottoni: il balzo del cuore ha la mano di tutto il resto. */
const SPRING = { ...motion.press, reduceMotion: ReduceMotion.System };

/**
 * Cuore dei preferiti. Si ritrae sotto il dito come ogni altro bottone e,
 * quando diventa preferito, l'icona fa un piccolo balzo oltre la misura
 * prima di tornare a posto: un cambio di stato merita piu' di un cambio
 * di colore. Toglierlo non salta: e' un passo indietro, non un traguardo.
 * Il balzo parte dal tocco, non dallo stato: cosi' non scatta quando il
 * preferito cambia da un'altra schermata.
 */
export function HeartButton({ track, size = 22 }: Props) {
  const { favorites } = useLibrary();
  const on = favorites.includes(track.uid);
  const pop = useSharedValue(1);
  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.get() }] }));

  return (
    <PressableScale
      containerStyle={touch.target}
      scaleTo={motion.iconPressScale}
      onPress={() => {
        haptics.toggle(!on);
        if (!on) pop.set(withSequence(withSpring(1.15, SPRING), withSpring(1, SPRING)));
        toggleFavorite(track);
      }}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      accessibilityLabel={on ? 'Togli dai preferiti' : 'Aggiungi ai preferiti'}
    >
      <Animated.View style={popStyle}>
        <Ionicons
          name={on ? 'heart' : 'heart-outline'}
          size={size}
          color={on ? colors.accent : colors.textMuted}
        />
      </Animated.View>
    </PressableScale>
  );
}

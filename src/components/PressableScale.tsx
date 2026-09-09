import type { ReactNode } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { haptics, type HapticKind } from '@/services/haptics';
import { motion } from '@/theme';

interface Props extends Omit<PressableProps, 'style' | 'children'> {
  children?: ReactNode;
  /** Stile del contenitore che si anima: sfondo, padding e raggio vanno qui. */
  style?: StyleProp<ViewStyle>;
  /** Stile del Pressable esterno, per il layout nel genitore (flex, alignSelf, margini). */
  containerStyle?: StyleProp<ViewStyle>;
  /** Fattore di scala alla pressione. */
  scaleTo?: number;
  /** Feedback tattile emesso al tocco, se il dispositivo lo supporta. */
  haptic?: HapticKind;
}

const SPRING = { ...motion.press, reduceMotion: ReduceMotion.System };

/**
 * Pressable che si ritrae sotto il dito e torna con una molla.
 *
 * Il feedback di pressione era solo cromatico, e su alcuni bottoni non
 * c'era affatto. Qui la risposta e' fisica: il contenitore si stringe di
 * poco appena lo tocchi e riprende la misura quando lasci, con la stessa
 * molla ovunque, cosi' l'app ha una sola "mano". Rispetta "Rimuovi
 * animazioni" del sistema.
 *
 * Lo stile visivo va sul contenitore animato, non sul Pressable: se
 * scalasse solo un figlio, sfondo e bordi resterebbero fermi e si
 * vedrebbe. Il Pressable esterno fa solo da bersaglio.
 */
export function PressableScale({
  children,
  style,
  containerStyle,
  scaleTo = motion.pressScale,
  haptic,
  onPressIn,
  onPressOut,
  onPress,
  ...rest
}: Props) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  return (
    <Pressable
      {...rest}
      style={containerStyle}
      onPressIn={(event) => {
        scale.set(withSpring(scaleTo, SPRING));
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        scale.set(withSpring(1, SPRING));
        onPressOut?.(event);
      }}
      onPress={(event) => {
        if (haptic) haptics[haptic]();
        onPress?.(event);
      }}
    >
      <Animated.View style={[style, animated]}>{children}</Animated.View>
    </Pressable>
  );
}

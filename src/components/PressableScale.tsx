import type { ReactNode } from 'react';
import {
  Pressable,
  type PressableProps,
  type PressableStateCallbackType,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
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
  /**
   * Stile aggiunto al contenitore mentre e' premuto. Serve dove la scala da
   * sola non basta: superfici larghe, dove il 2% non si vede, e "Rimuovi
   * animazioni" attivo, dove la molla salta al valore finale.
   */
  pressedStyle?: StyleProp<ViewStyle>;
  /** Stile del Pressable esterno, per il layout nel genitore (flex, alignSelf, margini). */
  containerStyle?: StyleProp<ViewStyle>;
  /** Fattore di scala alla pressione. */
  scaleTo?: number;
  /** Feedback tattile emesso al tocco, se il dispositivo lo supporta. */
  haptic?: HapticKind;
  /**
   * Attesa in ms prima di ritrarsi. Dentro uno scroller orizzontale il dito
   * che parte per scorrere e' un tocco fino a che lo scroll non lo ruba:
   * senza attesa ogni avvio di scroll farebbe guizzare l'elemento.
   */
  pressDelay?: number;
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
  pressedStyle,
  containerStyle,
  scaleTo = motion.pressScale,
  haptic,
  pressDelay,
  onPressIn,
  onPressOut,
  onPress,
  ...rest
}: Props) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  const content = (pressed: boolean) => (
    <Animated.View style={[style, pressed && pressedStyle, animated]}>{children}</Animated.View>
  );

  return (
    <Pressable
      {...rest}
      style={containerStyle}
      unstable_pressDelay={pressDelay}
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
      {/* Il render-prop fa ridisegnare il Pressable a ogni cambio di stato
          premuto: lo si usa solo quando c'e' uno stile da applicare. */}
      {pressedStyle
        ? ({ pressed }: PressableStateCallbackType) => content(pressed)
        : content(false)}
    </Pressable>
  );
}

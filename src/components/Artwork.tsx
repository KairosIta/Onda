import { Ionicons } from '@expo/vector-icons';
import { Image, type ImageTransition } from 'expo-image';
import { memo, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radius as radii } from '@/theme';

interface Props {
  uri?: string;
  /** Lato in dp. Omesso, le misure arrivano da `style` (es. larghezza piena). */
  size?: number;
  radius?: number;
  /**
   * Chiave stabile della riga nelle liste riciclate: senza, una riga
   * riusata mostra per un attimo la copertina della traccia precedente.
   */
  recyclingKey?: string;
  /**
   * `high` per l'immagine di testata di una schermata (player, album,
   * artista): una sola per pagina, prima delle copertine delle righe.
   */
  priority?: 'low' | 'normal' | 'high';
  /**
   * Dissolvenza all'arrivo. Nelle liste riciclate va spenta: expo-image su
   * Android la applica a ogni bind, anche quando la bitmap e' gia' in
   * memoria, e con lo scroll veloce le righe si accenderebbero a onde
   * invece di arrivare pronte.
   */
  fade?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Dissolvenza breve: si nota come cura, non come attesa. */
const TRANSITION: ImageTransition = { duration: 220, effect: 'cross-dissolve', timing: 'ease-out' };

/**
 * La copertina e' decorativa ovunque: chi la ospita ha gia' un'etichetta
 * (riga, card, mini-player) o e' pura testata. Senza questo, il segnaposto
 * — un Text di Ionicons con un glifo privato — diventerebbe una fermata
 * muta per TalkBack nel player e nelle testate, dove non c'e' un Pressable
 * ad assorbirlo.
 */
const decorative = {
  accessibilityElementsHidden: true,
  importantForAccessibility: 'no-hide-descendants',
} as const;

/**
 * Copertina con dissolvenza, cache su disco e un segnaposto vero.
 *
 * Prima ogni schermata usava `Image` di React Native: la copertina
 * compariva di colpo, senza una politica di cache dichiarata, e in
 * mancanza di artwork restava un quadrato vuoto con un bordo. Qui
 * un'immagine che non esiste o non arriva diventa una nota su fondo
 * neutro, e quella che arriva entra in dissolvenza su un fondo che ha
 * gia' il colore giusto.
 *
 * Il fallimento e' legato all'URL, non a un flag: cambiando traccia in
 * una riga riciclata il segnaposto non resta appiccicato alla riga.
 *
 * `memo` perche' le prop sono primitive (o stili di StyleSheet, stabili):
 * il mini-player e le righe si ridisegnano piu' spesso della copertina.
 */
export const Artwork = memo(function Artwork({
  uri,
  size,
  radius = radii.sm,
  recyclingKey,
  priority,
  fade = true,
  style,
}: Props) {
  const [failedUri, setFailedUri] = useState<string | undefined>(undefined);
  const showImage = Boolean(uri) && failedUri !== uri;
  const iconSize = size !== undefined ? Math.max(14, Math.round(size * 0.42)) : 48;

  return (
    <View
      style={[
        styles.frame,
        size !== undefined ? { width: size, height: size } : null,
        { borderRadius: radius },
        style,
      ]}
      {...decorative}
    >
      {showImage ? (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={fade ? TRANSITION : null}
          cachePolicy="memory-disk"
          recyclingKey={recyclingKey}
          priority={priority}
          onError={() => setFailedUri(uri)}
          accessible={false}
        />
      ) : (
        <View style={styles.empty}>
          <Ionicons name="musical-note" size={iconSize} color={colors.textMuted} />
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  frame: { overflow: 'hidden', backgroundColor: colors.surfaceHigh },
  empty: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

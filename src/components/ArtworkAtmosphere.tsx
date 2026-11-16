import { Image } from 'expo-image';
import { memo, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { artworkCacheKey, artworkCachePolicy } from '@/services/artworkCachePolicy';
import { colors } from '@/theme';
import type { SourceId } from '@/types/track';

interface Props {
  uri?: string;
  source?: SourceId;
  recyclingKey: string;
  backgroundColor?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Alone ricavato dalla copertina, senza estrazioni di colore o nuove richieste
 * a servizi esterni. Riusa la chiave e la policy dell'artwork: Audius resta
 * in memoria, anche qui. L'immagine e' statica, a bassa priorita', e non si
 * anima col progresso del player. La vignetta la riporta al fondo inchiostro
 * prima dei bordi, lasciando testo e comandi sul loro sfondo abituale.
 */
export const ArtworkAtmosphere = memo(function ArtworkAtmosphere({
  uri,
  source,
  recyclingKey,
  backgroundColor = colors.bg,
  style,
}: Props) {
  const [failedUri, setFailedUri] = useState<string | undefined>();

  return (
    <View
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, styles.root, { backgroundColor }, style]}
    >
      {uri && failedUri !== uri ? (
        <Image
          source={{ uri, cacheKey: artworkCacheKey(source, uri) }}
          style={[StyleSheet.absoluteFill, styles.image]}
          contentFit="cover"
          blurRadius={32}
          cachePolicy={artworkCachePolicy(source)}
          recyclingKey={recyclingKey}
          priority="low"
          transition={null}
          autoplay={false}
          accessible={false}
          onError={() => setFailedUri(uri)}
        />
      ) : null}
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            // closest-side raggiunge il fondo opaco su tutti e quattro i bordi.
            experimental_backgroundImage: `radial-gradient(ellipse closest-side at center, transparent 35%, ${backgroundColor} 100%)`,
          },
        ]}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  root: { overflow: 'hidden' },
  image: { opacity: 0.4 },
});

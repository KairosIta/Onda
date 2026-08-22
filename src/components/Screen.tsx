import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@/theme';
import { MiniPlayer } from './MiniPlayer';

/**
 * Contenitore per le schermate spinte sullo Stack radice (playlist,
 * raccolte, artista). Dentro i tab il MiniPlayer lo disegna la tab bar
 * custom; qui la tab bar non c'e', quindi lo montiamo noi — altrimenti
 * uscendo dalla libreria il player sparisce a meta' brano.
 */
export function Screen({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      <View style={styles.body}>{children}</View>
      <MiniPlayer />
      <View style={[styles.inset, { height: insets.bottom }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  body: { flex: 1 },
  inset: { backgroundColor: colors.surface },
});
